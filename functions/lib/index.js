"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.identifyMedication = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const vertexai_1 = require("@google-cloud/vertexai");
// Initialize Firebase Admin
admin.initializeApp();
// Initialize Vertex AI with explicit configuration
const initializeVertexAI = () => {
    try {
        // Ensure required environment variables are set
        if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            console.warn('GOOGLE_APPLICATION_CREDENTIALS not set. Using default application credentials.');
        }
        const projectId = process.env.GCLOUD_PROJECT || 'pharmalensmedix';
        const location = process.env.VERTEX_AI_LOCATION || 'us-central1';
        console.log(`Initializing Vertex AI with project: ${projectId}, location: ${location}`);
        const vertexAi = new vertexai_1.VertexAI({
            project: projectId,
            location: location,
        });
        const model = vertexAi.preview.getGenerativeModel({
            model: 'gemini-1.5-pro-001',
            generationConfig: {
                maxOutputTokens: 2048,
                temperature: 0.7,
            },
            safetySettings: [
                {
                    category: vertexai_1.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: vertexai_1.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                },
                {
                    category: vertexai_1.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold: vertexai_1.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                },
            ],
        });
        console.log('Vertex AI model initialized successfully');
        return model;
    }
    catch (error) {
        const errorMessage = `Failed to initialize Vertex AI: ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMessage, error);
        throw new functions.https.HttpsError('internal', 'AI service initialization failed', errorMessage);
    }
};
/**
 * Simplified medication identification function
 */
// Initialize Vertex AI model at module level
const vertexAi = (() => {
    try {
        const projectId = process.env.GCLOUD_PROJECT || 'pharmalensmedix';
        const location = process.env.VERTEX_AI_LOCATION || 'us-central1';
        console.log(`Initializing Vertex AI with project: ${projectId}, location: ${location}`);
        return new vertexai_1.VertexAI({
            project: projectId,
            location: location,
        });
    }
    catch (error) {
        console.error('Failed to initialize Vertex AI:', error);
        throw new Error('Failed to initialize Vertex AI');
    }
})();
// Initialize the model with safety settings
const getModel = () => {
    return vertexAi.preview.getGenerativeModel({
        model: 'gemini-1.5-pro-001',
        generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.7,
        },
        safetySettings: [
            {
                category: vertexai_1.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: vertexai_1.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
                category: vertexai_1.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: vertexai_1.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
        ],
    });
};
exports.identifyMedication = functions.https.onCall(async (requestData) => {
    try {
        const data = requestData;
        // Basic input validation
        if (!data) {
            throw new functions.https.HttpsError('invalid-argument', 'Request data is required');
        }
        // Check for required fields
        if (!data.imageBase64 && (!data.imprint || !data.color || !data.shape)) {
            throw new functions.https.HttpsError('invalid-argument', 'Either imageBase64 or all of (imprint, color, shape) are required');
        }
        console.log('Starting medication identification...');
        // Build the prompt based on available data
        let prompt = 'Identify this medication';
        if (data.imprint && data.color && data.shape) {
            prompt += ` with the following characteristics:\n`;
            prompt += `- Imprint: ${data.imprint}\n`;
            prompt += `- Color: ${data.color}\n`;
            prompt += `- Shape: ${data.shape}`;
        }
        // Add image data if available
        const parts = [];
        if (data.imageBase64) {
            parts.push({
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: data.imageBase64.split(',')[1] // Remove data URL prefix if present
                }
            });
        }
        parts.push({
            text: prompt
        });
        // Get the model instance
        const model = getModel();
        // Generate content with Vertex AI
        const result = await model.generateContent({
            contents: [{
                    role: 'user',
                    parts: parts
                }]
        });
        // Parse the response
        const response = result.response;
        // Get the text from the first candidate
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from AI';
        // Parse the response into a structured format
        const medicationData = {
            medicationName: 'Identified Medication',
            primaryUse: 'Treatment of condition',
            activeIngredients: 'Active ingredients',
            ageGroup: 'All ages',
            treatableSymptoms: 'Various symptoms',
            contraindicatedGroups: 'None known',
            dosageDuration: 'As prescribed by physician',
            commonSideEffects: 'Nausea, headache',
            severeReactions: 'Allergic reactions',
            doNotMixWith: 'Other medications',
            medicationInteractions: 'Possible interactions with other drugs',
            alternativeMedications: 'Alternative options available',
            disclaimer: 'This is a simulated response. Always consult a healthcare professional.',
            counterfeitWarning: 'Purchase from licensed pharmacies only'
        };
        // Try to extract structured data from the response
        try {
            // Look for JSON in the response
            const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
            if (jsonMatch && jsonMatch[1]) {
                const parsedData = JSON.parse(jsonMatch[1]);
                return {
                    success: true,
                    data: { ...medicationData, ...parsedData }
                };
            }
        }
        catch (parseError) {
            console.warn('Failed to parse AI response as JSON, using fallback', parseError);
        }
        // Fallback to returning the raw text
        return {
            success: true,
            data: {
                ...medicationData,
                rawResponse: text
            }
        };
    }
    catch (error) {
        console.error('Error in identifyMedication:', error);
        if (error instanceof Error) {
            return {
                success: false,
                data: {
                    medicationName: 'Error',
                    primaryUse: 'Unable to process request',
                    activeIngredients: 'N/A',
                    disclaimer: 'An error occurred while processing your request. Please try again.',
                    error: error.message
                }
            };
        }
        return {
            success: false,
            data: {
                medicationName: 'Error',
                primaryUse: 'Unable to process request',
                activeIngredients: 'N/A',
                disclaimer: 'An unknown error occurred. Please try again.'
            },
            error: 'Unknown error occurred'
        };
    }
});
//# sourceMappingURL=index.js.map