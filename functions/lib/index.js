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
const z = __importStar(require("zod"));
// Initialize Firebase Admin
admin.initializeApp();
// Initialize Vertex AI with your project and location
const vertexAiOptions = {
    project: process.env.GCLOUD_PROJECT,
    location: 'us-central1',
};
const vertexAi = new vertexai_1.VertexAI(vertexAiOptions);
// Initialize the model (using Gemini 1.5 Pro)
const generativeModel = vertexAi.preview.getGenerativeModel({
    model: 'gemini-1.5-pro-001',
    generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
    },
});
// Define the Zod schema for the expected AI response structure.
// This ensures type safety and helps validate the AI's output.
const MedicationResultSchema = z.object({
    medicationName: z.string(),
    primaryUse: z.string(),
    activeIngredients: z.string(),
    ageGroup: z.string(),
    treatableSymptoms: z.string(),
    contraindicatedGroups: z.string(),
    dosageDuration: z.string(),
    approximateCostKSH: z.string(),
    commonSideEffects: z.string(),
    severeReactions: z.string(),
    doNotMixWith: z.string(),
    medicationInteractions: z.string(),
    alternativeMedications: z.string(),
    disclaimer: z.string(),
    counterfeitWarning: z.string()
});
/**
 * Callable Cloud Function to identify medication based on provided details
 * (image, imprint, color, shape) using Google's Vertex AI.
 */
exports.identifyMedication = functions.https.onCall(async (request) => {
    const data = request.data;
    try {
        const { imageBase64, imprint, color, shape } = data;
        // Validate input
        if (!imageBase64 && !imprint && !color && !shape) {
            throw new functions.https.HttpsError('invalid-argument', 'Please provide either an image or medication details.');
        }
        // Construct the prompt for the AI model
        const prompt = `
      Act as an expert pharmacist. Identify the medication based on the following details:
      ${imprint ? `- Imprint: ${imprint}\n` : ''}
      ${color ? `- Color: ${color}\n` : ''}
      ${shape ? `- Shape: ${shape}\n` : ''}
      
      Provide the following information in valid JSON format:
      {
        "medicationName": "The name of the medication",
        "primaryUse": "What is this medication used for?",
        "activeIngredients": "List the active ingredients",
        "ageGroup": "Who is this medication for?",
        "treatableSymptoms": "What symptoms does it treat?",
        "contraindicatedGroups": "Who should not take this medication?",
        "dosageDuration": "What is the recommended dosage and duration?",
        "approximateCostKSH": "Estimated cost in Kenyan Shillings",
        "commonSideEffects": "List common side effects",
        "severeReactions": "List any severe reactions",
        "doNotMixWith": "What should not be taken with this medication?",
        "medicationInteractions": "Any known drug interactions",
        "alternativeMedications": "List alternative medications",
        "disclaimer": "Important safety information",
        "counterfeitWarning": "How to spot counterfeit versions"
      }
      
      If the medication cannot be identified, set "medicationName" to "Unknown" and explain in the "disclaimer".
      Ensure the response is valid JSON that can be parsed with JSON.parse().
    `;
        // Prepare the request for Vertex AI
        const request = {
            contents: [{
                    role: 'user',
                    parts: [{
                            text: prompt
                        }]
                }]
        };
        // Add image data if provided
        if (imageBase64) {
            const imageData = imageBase64.split(',')[1] || imageBase64;
            const imagePart = {
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: imageData
                }
            };
            // @ts-ignore - The type definition might be missing inlineData
            request.contents[0].parts.push(imagePart);
        }
        console.log('Sending request to Vertex AI...');
        // Generate content using Vertex AI
        const result = await generativeModel.generateContent(request);
        const response = result.response;
        if (!response || !response.candidates || response.candidates.length === 0) {
            throw new functions.https.HttpsError('internal', 'No response received from the AI service.');
        }
        // Extract the text response safely
        const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) {
            throw new functions.https.HttpsError('internal', 'No valid response received from the AI service.');
        }
        // Try to parse the JSON response
        try {
            const resultData = typeof responseText === 'string'
                ? JSON.parse(responseText)
                : responseText;
            // Validate the response against our schema
            const validatedData = MedicationResultSchema.parse(resultData);
            return {
                success: true,
                data: validatedData
            };
        }
        catch (parseError) {
            console.error('Error parsing AI response:', parseError);
            throw new functions.https.HttpsError('internal', 'The AI response could not be properly formatted. Please try again.');
        }
    }
    catch (error) {
        console.error('Error in identifyMedication:', error);
        // Handle different types of errors
        if (error.code === 'functions/aborted') {
            throw new functions.https.HttpsError('deadline-exceeded', 'Request timed out');
        }
        else if (error.code === 'functions/resource-exhausted') {
            throw new functions.https.HttpsError('resource-exhausted', 'Too many requests. Please try again later.');
        }
        else if (error.code === 'permission-denied') {
            throw new functions.https.HttpsError('permission-denied', 'Permission denied. Please check your Google Cloud permissions.');
        }
        // Default error
        throw new functions.https.HttpsError('internal', error.message || 'An unexpected error occurred while identifying the medication.');
    }
});
//# sourceMappingURL=index.js.map