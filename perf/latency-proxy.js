// TCP latency-injecting proxy — sits between the server and MongoDB to imitate a DB in another region.
//
// Production measurements (perf/feed-api.js) put one DB round trip at roughly 70ms. A local mongod
// answers in ~0.1ms, where optimizations that cut the number of queries show no benefit at all. So each
// direction gets RTT/2 of delay, letting before/after be compared under production-like conditions.
const net = require('net');

function startLatencyProxy({ targetHost, targetPort, rttMs }) {
  const oneWay = rttMs / 2;
  // Ordering guarantee: chunks from one socket stay FIFO, each released at its arrival time + oneWay
  const pipeDelayed = (from, to) => {
    let lastRelease = 0;
    from.on('data', (chunk) => {
      const release = Math.max(Date.now() + oneWay, lastRelease);
      lastRelease = release;
      setTimeout(() => { if (!to.destroyed) to.write(chunk); }, release - Date.now());
    });
    from.on('end', () => setTimeout(() => to.end(), oneWay));
    from.on('error', () => to.destroy());
  };

  const server = net.createServer((client) => {
    const upstream = net.connect(targetPort, targetHost);
    // Disable Nagle — otherwise small packets wait on the previous packet's ACK and the delay compounds
    // (the MongoDB driver sets noDelay on its own sockets too)
    client.setNoDelay(true);
    upstream.setNoDelay(true);
    pipeDelayed(client, upstream);
    pipeDelayed(upstream, client);
    upstream.on('error', () => client.destroy());
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

module.exports = { startLatencyProxy };
