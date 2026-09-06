import {useEffect, useState} from "react";
import { apiService } from "../services/api.service";

interface HealthResponse {
    success: boolean;
    message: string;
    data: {
        timestamp: string;
    };
}

function Healthpage () {
    const [health, setHealth] = useState<HealthResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const checkHealth = async () => {
            try {
                const res = await apiService.getHealth();
                setHealth(res);
            } catch (error) {
                setError("Backend Is Unavailable");
            }
        }
        checkHealth();
    }, []);

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <h1 className="text-3xl font-bold">
            AI Invoice Assistant
            </h1>

            <p className="mt-3 text-gray-600">
            Backend Connection Status
            </p>

            {health && (
            <p className="mt-5 text-green-600 font-semibold">
                🟢 {health.message}
            </p>
            )}

            {error && (
            <p className="mt-5 text-red-600 font-semibold">
                🔴 {error}
            </p>
            )}
        </div>
        </div>
    );

}

export default Healthpage;