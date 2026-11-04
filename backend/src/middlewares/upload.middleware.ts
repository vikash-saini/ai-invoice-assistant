import multer from 'multer';
import { AppError } from "../utils/app-error";

const MAX_FILE_SIZE = 10 * 1024 * 1024; //10MB
const storage = multer.memoryStorage();

export const uploadInvoice = multer({
    storage,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1,
    },
    fileFilter: (_req, file, cb) => {
    const isPdf =
      file.mimetype === "application/pdf" &&
      file.originalname.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      cb(new AppError("Only PDF invoice files are allowed", 400));
      return;
    }

    cb(null, true);
  },
});