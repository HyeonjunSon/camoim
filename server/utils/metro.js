// Metro-area mapping: fold nearby small towns into the large city for search
const METRO_AREAS = [
  [
    'Toronto', 'Mississauga', 'Brampton', 'Markham', 'Vaughan',
    'Oakville', 'Burlington', 'Hamilton', 'Oshawa', 'Barrie',
    'Guelph', 'Cambridge', 'Kitchener', 'Waterloo',
  ],
  ['Vancouver', 'Burnaby', 'Surrey', 'Richmond', 'Coquitlam'],
];

function expandCity(city) {
  if (!city) return null;
  const group = METRO_AREAS.find(g => g.includes(city));
  return group || [city];
}

module.exports = { METRO_AREAS, expandCity };
