import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

// Initialize Gemini API client on the server side
const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

// Lazy initialization client getter
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not defined");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let documents: { url: string; type?: string }[] = [];

    if (body.documents && Array.isArray(body.documents)) {
      documents = body.documents;
    } else if (body.url) {
      documents = [{ url: body.url, type: body.type }];
    }

    if (documents.length === 0) {
      return NextResponse.json({ error: "Missing documents to scan" }, { status: 400 });
    }

    // 1. Fetch file data on the server side for all documents (in parallel for maximum performance)
    const validDocs = documents.filter((docItem) => docItem && docItem.url);
    if (validDocs.length === 0) {
      return NextResponse.json({ error: "No valid documents could be loaded" }, { status: 420 });
    }

    const docPromises = validDocs.map(async (docItem) => {
      try {
        const fileResponse = await fetch(docItem.url);
        if (!fileResponse.ok) {
          throw new Error(`Failed to retrieve document: ${fileResponse.statusText}`);
        }
        const contentType = fileResponse.headers.get("content-type") || docItem.type || "image/jpeg";
        const arrayBuffer = await fileResponse.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString("base64");
        return {
          inlineData: {
            mimeType: contentType,
            data: base64Data,
          },
        };
      } catch (err) {
        console.error(`Error fetching document ${docItem.url}:`, err);
        return null;
      }
    });

    const resolvedParts = await Promise.all(docPromises);
    const contentParts = resolvedParts.filter((part): part is any => part !== null);

    if (contentParts.length === 0) {
      return NextResponse.json({ error: "Failed to download any of the uploaded documents" }, { status: 422 });
    }

    // 2. Validate environment & initialize client
    const ai = getAiClient();

    // 3. Perform Gemini API call with structured output
    const prompt = `Review the provided document(s) in order from top to bottom. They can be National ID cards, driver's licenses, or passports (which may reside on separate images, e.g., front and back, or multiple different papers). Combine the information extracted from all documents and return a single cohesive structured JSON output.

PRISTINE ACCURACY RULES FOR NAMES, NUMBERS & IDENTIFYING FIELDS:

1. **Name Extraction Accuracy**:
   - Locate the surname/last name and the given names/first name(s) carefully. 
   - Some documents print the last name first (e.g. "KAYA AHMET"). Do not confuse the ordering. Combine them with the first name(s) first, then the last name (e.g., "AHMET KAYA"), in fully UPPERCASE letters.
   - Do NOT duplicate names if they appear multiple times or in MRZ (Machine Readable Zone) blocks at the bottom.
   - For names with non-English characters (e.g., Turkish characters like Ö, Ç, Ş, Ğ, Ü, İ, or other national diacritics), preserve them if they are clear, or fallback to the MRZ representation (which translates characters to English letters, e.g. O, C, S, G, U, I) only if the primary text is unreadable.

2. **Passport ID Accuracy**:
   - Locate the passport number. Passports typically start with one or two alpha letters (e.g., "U" or "A" for Turkish, "C" for European) followed by numbers.
   - CRITICAL: You MUST extract the entire alphanumeric passport ID string EXACTLY. Do NOT omit, ignore, or truncate the starting letter prefix! If the passport number is "U12345678", do NOT output "12345678" - you MUST output "U12345678" with the leading letter.
   - Pay close attention to alphanumeric character boundaries to prevent OCR mapping errors: do not confuse the letter "O" with the digit "0", the letter "I" with the digit "1", "S" with "5", or "U" with "V".

3. **Driver's License / ID Number Accuracy**:
   - If a Driver's License is present, extract the license number. For Turkish and many European/regional driver's licenses, the field labeled or numbered "5." (typically near the top/center) specifies the license number. Extract this value EXACTLY, removing any spaces.
   - If a National Identity Card is uploaded instead of a Passport, extract the National Identification/Identity number (such as the 11-digit TR Identity Number / T.C. Kimlik No for Turkish National IDs) or the Serial/Document number, and populate it in "passportId" and/or "licenseId" fields as appropriate so that a primary ID number is always populated for the customer.

4. **Phone and Email**:
   - Phone: Extract any sequence starting with '+' or clear phone digits. Maintain the '+' symbol and the full international country prefix (e.g., '+90...'). Ensure no digits are skipped or misread.
   - Email: If an e-mail containing an '@' is on the document, capture the full correct email address exactly. Do not truncate the domain name.`;

    contentParts.push({
      text: prompt,
    });

    let response: any = null;
    let lastError: any = null;
    const modelsToTry = ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-flash-latest", "gemini-2.5-flash"];

    for (const modelName of modelsToTry) {
      for (let attempt = 1; attempt <= 1; attempt++) {
        try {
          console.log(`Scanning document with ${modelName} (Attempt ${attempt}/1)...`);
          response = await ai.models.generateContent({
            model: modelName,
            contents: contentParts,
            config: {
              // Minimize latency by disabling detailed multi-step planning / reasoning for OCR extraction
              thinkingConfig: modelName.startsWith("gemini-3") ? { thinkingLevel: ThinkingLevel.MINIMAL } : undefined,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  fullName: {
                    type: Type.STRING,
                    description: "The combined, uppercase dreadfully correct full name of the document owner.",
                  },
                  passportId: {
                    type: Type.STRING,
                    nullable: true,
                    description: "The document's passport number or National ID number/T.C. Kimlik. Correctly include all starting letter(s) and numbers exactly (e.g. 'U12345678'). Do not omit the letter prefix; otherwise null.",
                  },
                  licenseId: {
                    type: Type.STRING,
                    nullable: true,
                    description: "The document's license number if the document is a Driver's License (Field '5' for Turkish licenses); otherwise null.",
                  },
                  email: {
                    type: Type.STRING,
                    nullable: true,
                    description: "The full line containing the '@' symbol from the document, representing the email; otherwise null.",
                  },
                  phone: {
                    type: Type.STRING,
                    nullable: true,
                    description: "The phone number starting with '+' from the document; otherwise null.",
                  },
                },
                required: ["fullName", "passportId", "licenseId", "email", "phone"],
              },
            },
          });

          if (response && response.text) {
            break; // Exit the attempt loop if successful
          }
        } catch (err: any) {
          lastError = err;
          console.error(`Attempt ${attempt} with model ${modelName} encountered an error:`, err);
          
          const isLastModel = modelName === modelsToTry[modelsToTry.length - 1];
          const isLastAttempt = attempt === 1;
          
          if (!isLastModel || !isLastAttempt) {
            const waitTime = attempt * 500; // Scaled down the backoff wait logic from 1000ms increment to 500ms
            console.log(`Waiting ${waitTime}ms before next attempt/model...`);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
          }
        }
      }
      if (response && response.text) {
        break; // Exit the model loop if successful
      }
    }

    if (!response || !response.text) {
      let errorMsg = "";
      if (lastError) {
        if (typeof lastError === "object") {
          errorMsg = lastError.message || lastError.status || JSON.stringify(lastError);
        } else {
          errorMsg = String(lastError);
        }
      } else {
        errorMsg = "Unknown error during document scan";
      }

      console.error("Scanning failed completely. Last error details:", errorMsg);

      const isOverloaded = errorMsg.includes("503") || 
                           errorMsg.includes("502") ||
                           errorMsg.toLowerCase().includes("overloaded") || 
                           errorMsg.toLowerCase().includes("demand") || 
                           errorMsg.toLowerCase().includes("unavailable") ||
                           errorMsg.toLowerCase().includes("rate limit") ||
                           errorMsg.toLowerCase().includes("resource exhausted") ||
                           errorMsg.toLowerCase().includes("limit exceeded") ||
                           errorMsg.toLowerCase().includes("quota");
                           
      const formattedError = isOverloaded
        ? "The scanning service is currently experiencing very high demand from Google. Please try scanning again in a few seconds."
        : `Scanning failed: ${errorMsg}`;

      return NextResponse.json({ error: formattedError }, { status: 503 });
    }

    const parsedText = response.text;
    if (!parsedText) {
      return NextResponse.json({ error: "No response from scanning model" }, { status: 502 });
    }

    // Attempt to parse the structured output to ensure valid JSON format
    const extractedData = JSON.parse(parsedText);

    return NextResponse.json({
      success: true,
      data: extractedData,
    });
  } catch (error: unknown) {
    console.error("Gemini Scanning Route Error:", error);
    let message = "Scanning failed due to an unknown error";
    if (error instanceof Error) {
      message = error.message;
    } else if (error && typeof error === "object") {
      message = (error as any).message || JSON.stringify(error);
    } else if (error) {
      message = String(error);
    }

    const isOverloaded = message.includes("503") || 
                         message.includes("502") ||
                         message.toLowerCase().includes("overloaded") || 
                         message.toLowerCase().includes("demand") || 
                         message.toLowerCase().includes("unavailable") ||
                         message.toLowerCase().includes("rate limit") ||
                         message.toLowerCase().includes("resource exhausted") ||
                         message.toLowerCase().includes("limit exceeded") ||
                         message.toLowerCase().includes("quota");

    const formattedError = isOverloaded
      ? "The scanning service is currently experiencing very high demand from Google. Please try scanning again in a few seconds."
      : `Scanning failed: ${message}`;

    return NextResponse.json({ error: formattedError }, { status: 500 });
  }
}
