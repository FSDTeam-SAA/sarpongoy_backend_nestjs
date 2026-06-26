import nodemailer from 'nodemailer';
import config from '../config';

type MailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

const sendMailer = async (
  email: string,
  subject?: string,
  html?: string,
  attachments?: MailAttachment[],
) => {
  const transporter = nodemailer.createTransport({
    host: config.email.host,
    port: Number(config.email.port),
    secure: false,
    auth: {
      user: config.email.address,
      pass: config.email.pass,
    },
  });
  const info = await transporter.sendMail({
    from: `"iLearnReady" ${config.email.from}`,
    to: email,
    subject,
    html,
    attachments,
  });

  console.log('Message sent:', info.messageId);
};

export default sendMailer;
