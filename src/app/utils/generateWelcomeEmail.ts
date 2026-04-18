export const generateWelcomeEmail = (email: string, password: string) => {
  return `
  <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:40px;">
    <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 5px 15px rgba(0,0,0,0.1);">

      <div style="background:#4CAF50; padding:20px; text-align:center; color:white;">
        <h2>Welcome to Our Platform 🎉</h2>
      </div>

      <div style="padding:30px; color:#333;">
        <h3>Hello 👋,</h3>
        <p>Your account has been successfully created.</p>

        <div style="background:#f1f1f1; padding:15px; border-radius:8px; margin:20px 0;">
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Password:</strong> ${password}</p>
        </div>

        <p style="color:red;">
          ⚠️ Please change your password after first login for security.
        </p>
      <div style="background:#f4f4f4; padding:15px; text-align:center; font-size:12px; color:#777;">
        © 2026 Your Company. All rights reserved.
      </div>

    </div>
  </div>
  `;
};
