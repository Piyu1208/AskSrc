import { inngest } from "../client";
import { getDb } from "@/lib/db";
import { embedTexts } from "@/lib/rag/embeddings";
import {
  qdrant,
  ensureCollection,
  COLLECTION_NAME,
} from "@/lib/rag/qdrant";
import { deletePdf } from "@/lib/cloudinary";
import type { Chat } from "@/lib/models/chat";




export const deleteSource = inngest.createFunction(
  {
    id: "delete-source",
    name: "Delete Source",
    triggers: { event: "source/delete.requested" },
    retries: 3,
  },

  async ({ event, step }) => {
    const { sourceId, userId } = event.data as {
      sourceId: string;
      userId: string;
    };

    // 1. Verify source ownership and deletion status.
    const source = await step.run("get-source", async () => {
      const db = await getDb();

      return db.collection("sources").findOne({
        id: sourceId,
        userId,
        status: "deleting",
      });
    });

    if (!source) {
      return {
        success: true,
        sourceId,
        message: "Source already deleted or not marked for deletion.",
      };
    }

    // 2. Delete PDF from Cloudinary, if applicable.
    if (
      source.type === "pdf" &&
      typeof source.cloudinaryPublicId === "string" &&
      source.cloudinaryPublicId
    ) {
      await step.run("delete-cloudinary-pdf", async () => {
        await deletePdf(source.cloudinaryPublicId);
      });
    }

    // 3. Delete Qdrant vectors belonging to this user and source.
    await step.run("delete-qdrant-vectors", async () => {
      await qdrant.delete(COLLECTION_NAME, {
        wait: true,
        filter: {
          must: [
            {
              key: "userId",
              match: { value: userId },
            },
            {
              key: "sourceId",
              match: { value: sourceId },
            },
          ],
        },
      });
    });

    // 4. Remove source references from the user's chats.
    await step.run("remove-source-from-chats", async () => {
      const db = await getDb();

      await db.collection<Chat>("chats").updateMany(
        {
          userId,
          sourceIds: sourceId,
        },
        {
          $pull: { sourceIds: sourceId },
        },
      );
    });

    // 5. Delete MongoDB record last.
    await step.run("delete-mongodb-source", async () => {
      const db = await getDb();

      await db.collection("sources").deleteOne({
        id: sourceId,
        userId,
        status: "deleting",
      });
    });

    return {
      success: true,
      sourceId,
    };
  },
);