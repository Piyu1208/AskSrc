import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "asksource",
  ...(process.env.INNGEST_EVENT_KEY && {
    eventKey: process.env.INNGEST_EVENT_KEY,
  }),
  ...(process.env.INNGEST_SIGNING_KEY && {
    signingKey: process.env.INNGEST_SIGNING_KEY,
  }),
  ...(process.env.INNGEST_BASE_URL && !process.env.INNGEST_DEV && {
    baseUrl: process.env.INNGEST_BASE_URL,
  }),
});
