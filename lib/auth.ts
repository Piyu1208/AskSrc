import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import clientPromise from "./mongodb";
import nodemailer from "nodemailer";


const client = await clientPromise;
const db = client.db("AskSource");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  }
});

export const auth = betterAuth({
  database: mongodbAdapter(db, {
    client,
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await transporter.sendMail({
        from: `"AskSource" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: "Verify your AskSource email",
        html: `
        <h2>Verify your email</h2>
        <p>Hi ${user.name},</p>
        <p>Thanks for creating an AskSource account.</p>
        <p>
          <a href="${url}">Verify your email</a>
        </p>
        <p>This link will expire after 1 hour.</p>
      `,
      });
    },

    sendOnSignUp: true,
  },
});