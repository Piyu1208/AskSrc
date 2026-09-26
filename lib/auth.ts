import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import clientPromise from "./mongodb";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const client = await clientPromise;
const db = client.db("AskSource");

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
      void resend.emails.send({
        from: "AskSource <onboarding@resend.dev>",
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