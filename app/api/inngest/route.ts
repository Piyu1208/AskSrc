import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { pdfIngest } from "@/lib/inngest/functions/pdfIngest";
import { deleteSource } from "@/lib/inngest/functions/deleteSource";
import { ytIngest } from "@/lib/inngest/functions/ytIngest";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [pdfIngest, deleteSource, ytIngest],
});