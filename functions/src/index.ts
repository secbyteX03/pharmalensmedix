import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai';
// Genkit will be used for workflow orchestration
// Note: Genkit is currently in preview, so we'll use direct Vertex AI client for now
// import { genkit, configureGenkit } from '@genkit-ai/core';
// import { firebase } from '@genkit-ai/firebase';

// Type definitions for Vertex AI
interface Part {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface Content {
  role: string;
  parts: Part[];
}

interface GenerationConfig {
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
}

interface SafetySetting {
  category: string;
  threshold: string;
}

interface GenerateContentRequest {
  contents: Content[];
  generationConfig?: GenerationConfig;
  safetySettings?: SafetySetting[];
}

interface GenerateContentResponse {
  response?: {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
        }>;
      };
    }>;
  };
  error?: {
    message: string;
  };
}

// Type definitions for the request data
interface MedicationRequest {
  imageBase64?: string;
  imprint?: string;
  color?: string;
  shape?: string;
}

// Initialize Firebase Admin
admin.initializeApp();

// Genkit initialization will be added when the package is stable
// For now, we'll use direct Vertex AI client
// const genkitConfig = {
//   plugins: [
//     firebase({
//       projectId: process.env.GCLOUD_PROJECT,
//       location: process.env.FUNCTIONS_LOCATION || 'us-central1',
//     }),
//   ],
// };
// configureGenkit(genkitConfig);

// Simple response interface for TypeScript type safety
interface MedicationData {
  medicationName: string;
  primaryUse: string;
  activeIngredients: string;
  ageGroup?: string;
  treatableSymptoms?: string;
  contraindicatedGroups?: string;
  dosageDuration?: string;
  approximateCostKSH?: string;
  commonSideEffects?: string;
  severeReactions?: string;
  doNotMixWith?: string;
  medicationInteractions?: string;
  alternativeMedications?: string;
  disclaimer: string;
  counterfeitWarning?: string;
  [key: string]: string | undefined;
}

interface MedicationResponse {
  success: boolean;
  data: MedicationData;
  error?: string;
}

// Initialize Vertex AI with enhanced configuration
const vertexAi = new VertexAI({
  project: process.env.GCLOUD_PROJECT || 'pharmalensmedix',
  location: process.env.VERTEX_AI_LOCATION || 'us-central1',
  apiEndpoint: 'us-central1-aiplatform.googleapis.com',
});

// Model configuration
const modelConfig = {
  model: 'gemini-1.5-pro-001',
  generationConfig: {
    maxOutputTokens: 2048,
    temperature: 0.7,
  },
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ],
});

console.log('Vertex AI model initialized successfully');

/**
 * Simplified medication identification function
 */


// Initialize the Vertex AI model with proper TypeScript types
const model = vertexAi.preview.getGenerativeModel({
  model: 'gemini-pro-vision',
  generationConfig: {
    maxOutputTokens: 2048,
    temperature: 0.4,
    topP: 1,
    topK: 32,
  },
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ],
});
// Cloud Function to identify medication using Vertex AI
export const identifyMedication = functions.https.onCall(
  async (requestData: unknown, context): Promise<MedicationResponse> => {
    // Validate request data
    if (!requestData || typeof requestData !== 'object') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid request data'
      );
    }
    
    const data = requestData as MedicationRequest;

    // Enhanced input validation
    if (!data) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Request data is required'
      );
    }

    // Check for required fields based on the request type
    if (data.imageBase64) {
      // Image-based identification
      if (typeof data.imageBase64 !== 'string') {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Image data must be a base64-encoded string'
        );
      }
    } else {
      // Manual search validation
      if (!data.imprint && !data.color && !data.shape) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'At least one search parameter (imprint, color, or shape) is required for manual search'
        );
      }
    }

    try {
      const { imageBase64, imprint, color, shape } = data;

      // Validate at least one input is provided
      if (!imageBase64 && !imprint && !color && !shape) {
        return {
          success: false,
          data: {
            medicationName: 'Unknown',
            primaryUse: 'N/A',
            activeIngredients: 'N/A',
            disclaimer: 'Please provide either an image or medication details.'
          },
          error: 'No input provided'
        };
      }

      try {
        let result: MedicationData;
        
        if (data.imageBase64) {
          // Process image using Vertex AI
          const prompt = `Identify this medication based on the image. Provide details including:
          - Medication name and strength
          - Primary use
          - Active ingredients
          - Common side effects
          - Any warnings or precautions
          
          Format the response as a JSON object with these fields:
          {
            "medicationName": "...",
            "primaryUse": "...",
            "activeIngredients": "...",
            "ageGroup": "...",
            "treatableSymptoms": "...",
            "contraindicatedGroups": "...",
            "dosageDuration": "...",

        const request: GenerateContentRequest = {
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                ...(requestData.imageBase64 ? [{
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: requestData.imageBase64
                  }
                } as Part] : [])
              ]
            }
          ]
        };

        const response = await model.generateContent(request);
        
        // Parse the response safely
        const responseText = response.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        try {
          result = JSON.parse(responseText);
        } catch (error) {
          // Return a default response if parsing fails
          return {
            success: false,
            data: {
              medicationName: 'Unknown Medication',
              primaryUse: 'Could not identify medication',
              activeIngredients: 'Unknown',
              disclaimer: 'This is an automated identification and should be verified by a healthcare professional.',
              error: 'Failed to process medication information'
            }
          };
        }

        return {
          success: true,
          data: result,
        };
      } catch (error) {
        console.error('Error identifying medication:', error);
        return {
          success: false,
          data: {
            medicationName: 'Error',
            primaryUse: 'Could not identify medication',
            activeIngredients: '',
            error: error instanceof Error ? error.message : 'Unknown error occurred'
          },
        };
      }
    } catch (error) {
      console.error('Error in identifyMedication:', error);

      // Return a user-friendly error response
      return {
        success: false,
        data: {
          medicationName: 'Error',
          primaryUse: 'Unable to process request',
          activeIngredients: 'N/A',
          disclaimer: 'An error occurred while processing your request. Please try again.'
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
);
