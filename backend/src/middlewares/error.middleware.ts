
import { ErrorRequestHandler } from "express";
import multer from "multer";
import { AppError } from "../utils/app-error";

export const errorHandler: ErrorRequestHandler = (
    err,
    _req,
    res,
    _next
) => {
    let statusCode = 500;
    let message = "Internal Server Error";

    if (err instanceof AppError) {
        statusCode = err.statusCode;
        message = err.message;
    } else if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            statusCode = 413;
            message = "File exceeds the maximum allowed size of 10 MB";
        } else if (err.code === "LIMIT_FILE_COUNT") {
            statusCode = 400;
            message = "Only one invoice file can be uploaded at a time";
        } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
            statusCode = 400;
            message = "Unexpected file field. Use the field name 'invoice'";
        } else {
            statusCode = 400;
            message = "Invalid file upload";
        }
    }

    if (statusCode >= 500) {
        console.error("Unexpected application error:", err);
    }

    res.status(statusCode).json({
        success: false,
        message
    });
};
