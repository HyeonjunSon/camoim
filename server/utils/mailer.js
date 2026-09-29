const crypto = require('crypto');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// Sender address — must be a domain already verified with Resend
// Before domain verification, fall back to 'onboarding@resend.dev' (which can only mail your own address)
const FROM_ADDRESS = process.env.MAIL_FROM || 'CaMoim <onboarding@resend.dev>';

// Generate a 6-digit code — Math.random() is a predictable PRNG, so use a CSPRNG
function generateCode() {
  return String(crypto.randomInt(100000, 1000000));
}

// Send the verification email
async function sendVerificationEmail(to, code) {
  const text = [
    '캐모임 이메일 인증',
    '',
    `인증 코드: ${code}`,
    '',
    '이 코드는 10분간 유효합니다.',
    '본인이 요청하지 않은 경우 이 이메일을 무시해주세요.',
    '',
    '— CaMoim 팀',
  ].join('\n');

  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: '캐모임 이메일 인증 코드',
    text,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 20px;">
        <h2 style="color: #1a1a1a; margin-bottom: 8px;">캐모임 이메일 인증</h2>
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
  });

  if (error) {
    // Let the Resend error bubble up (the catch block in routes/auth.js logs it)
    const err = new Error(error.message || 'Resend 이메일 발송 실패');
    err.code = error.name || 'RESEND_ERROR';
    err.response = error;
    throw err;
  }

  return data;
}

// Send the password reset email
async function sendPasswordResetEmail(to, code) {
  const text = [
    'CaMoim Password Reset / 캐모임 비밀번호 재설정',
    '',
    `Reset code: ${code}`,
    '',
    'This code is valid for 15 minutes. / 이 코드는 15분간 유효합니다.',
    'If you did not request this, please ignore this email.',
    '본인이 요청하지 않았다면 이 이메일을 무시해주세요.',
    '',
    '— CaMoim',
  ].join('\n');

  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: 'CaMoim Password Reset / 캐모임 비밀번호 재설정 코드',
    text,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 20px;">
        <h2 style="color: #1a1a1a; margin-bottom: 8px;">Reset Your Password</h2>
        <p style="color: #666; font-size: 14px; line-height: 1.6;">
          Enter this code to reset your password. Code is valid for 15 minutes.<br/>
          아래 코드로 비밀번호를 재설정해주세요. 코드는 15분간 유효합니다.
        </p>
        <div style="background: #f5f5f5; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #4F46E5;">${code}</span>
        </div>
        <p style="color: #999; font-size: 12px;">
          If you did not request this, please ignore this email.<br/>
          본인이 요청하지 않았다면 이 이메일을 무시해주세요.
        </p>
      </div>
    `,
  });

  if (error) {
    const err = new Error(error.message || 'Resend password reset email failed');
    err.code = error.name || 'RESEND_ERROR';
    err.response = error;
    throw err;
  }
  return data;
}

module.exports = { generateCode, sendVerificationEmail, sendPasswordResetEmail };
