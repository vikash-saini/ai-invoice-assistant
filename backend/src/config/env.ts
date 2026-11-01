import dotenv from 'dotenv';

dotenv.config();

export const env = {
    port: Number(process.env.PORT) || 5000,
    nodeEnv: process.env.NODE_ENV || "development",
    openAiApiKey: process.env.OPENAI_API_KEY || "",
    openAiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
    uploadDir: process.env.UPLOAD_DIR || "uploads",
    databasePath: process.env.DATABASE_PATH || "./database.sqlite"
}
