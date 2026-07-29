import dotenv from 'dotenv';

dotenv.config();

export const env = {
    port: Number(process.env.PORT) || 5000,
    nodeEnv: process.env.NODE_ENV || "development",
    openAiApiKey: process.env.OPENAI_API_KEY || "",
    uploadDir: process.env.UPLOAD_DIR || "uploads",
    databasePath: process.env.DATABASE_PATH || "./database.sqlite"
}
