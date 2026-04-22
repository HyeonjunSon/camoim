const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// 6자리 인증 코드 생성
function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// 인증 이메일 발송
async function sendVerificationEmail(to, code) {
  const mailOptions = {
    from: `"카모임" <${process.env.GMAIL_USER}>`,
    to,
    subject: '[카모임] 이메일 인증 코드',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 20px;">
        <h2 style="color: #1a1a1a; margin-bottom: 8px;">카모임 이메일 인증</h2>
        <p style="color: #666; font-size: 14px; line-height: 1.6;">
          아래 인증 코드를 입력해주세요. 코드는 10분간 유효합니다.
        </p>
        <div style="background: #f5f5f5; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #4F46E5;">${code}</span>
        </div>
        <p style="color: #999; font-size: 12px;">
          본인이 요청하지 않은 경우 이 이메일을 무시해주세요.
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}

module.exports = { generateCode, sendVerificationEmail };
