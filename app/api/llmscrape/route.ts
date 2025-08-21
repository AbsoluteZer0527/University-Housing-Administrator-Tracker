import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Groq from "groq-sdk";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!
});

// 1. Helper: get or create university
async function getOrCreateUniversity(universityName: string, domain: string | null) {
  const { data: existing } = await supabase
    .from("universities")
    .select("*")
    .ilike("name", `%${universityName}%`)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("universities")
    .insert({
      name: universityName,
      website: domain ? `https://${domain}` : null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return created;
}

// 2. LLM request helper using Groq
async function queryLLM(prompt: string) {
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that provides accurate, concise responses. When asked for JSON, return only valid JSON with no additional text."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: "llama-3.1-8b-instant", // Fast and free
      temperature: 0.1, // Low temperature for consistent results
      max_tokens: 1000
    });

    return completion.choices[0].message.content || "";
  } catch (err) {
    console.warn("⚠️ LLM request failed:", err);
    return null;
  }
}

// 3. API handler
export async function POST(req: Request) {
  const { universityName } = await req.json();

  if (!universityName) {
    return NextResponse.json(
      { error: "Missing universityName" },
      { status: 400 }
    );
  }

  try {
    // Step 1: Ask LLM for homepage domain
    const domainPrompt = `What is the official .edu website domain for "${universityName}"? 
    
Examples:
- "University of California, Berkeley" -> "berkeley.edu"
- "Stanford University" -> "stanford.edu"
- "Harvard University" -> "harvard.edu"

Return only the domain (like "example.edu"), no other text.`;

    const domainText = await queryLLM(domainPrompt);
    const domain = domainText?.match(/[a-zA-Z0-9.-]+\.edu/)?.[0] || null;

    if (!domain) {
      console.warn("⚠️ Could not extract domain from LLM response:", domainText);
      return NextResponse.json({
        success: false,
        message: "LLM could not determine university domain. Fallback to /api/scrape.",
        fallback: true,
      });
    }

    // Step 2: Get or create university row
    const university = await getOrCreateUniversity(universityName, domain);

    // Step 3: Ask LLM for likely housing contact information
    // Note: LLMs can't actually scrape live websites, so we ask for common patterns
    const contactPrompt = `Based on your knowledge of "${universityName}" (${domain}), provide typical housing administration contact information that would commonly be found at this university.

Generate realistic housing department contacts in this exact JSON format:

[
  {
    "name": "Full Name",
    "role": "Director of Housing",
    "email": "housing@${domain}",
    "phone": "555-123-4567",
    "source_url": "https://${domain}/housing"
  }
]

Focus on common roles like:
- Director of Housing/Residential Life
- Housing Operations Manager
- Residence Hall Coordinator
- Student Housing Services

Return only the JSON array, no other text.`;

    const adminsText = await queryLLM(contactPrompt);
    
    if (!adminsText) {
      return NextResponse.json({
        success: false,
        message: "LLM request failed. Fallback to /api/scrape.",
        fallback: true,
      });
    }

    // Extract JSON from response
    const jsonMatch = adminsText.match(/\[[\s\S]*\]/);
    let admins: any[] = [];
    
    if (jsonMatch) {
      try {
        admins = JSON.parse(jsonMatch[0]);
        
        // Validate that we got actual contact data
        admins = admins.filter(admin => 
          admin.email && 
          admin.email.includes('@') && 
          admin.name && 
          admin.name !== "Full Name"
        );
        
      } catch (parseError) {
        console.warn("⚠️ LLM JSON parse failed:", parseError);
        console.warn("LLM Response was:", adminsText);
      }
    }

    if (!admins || admins.length === 0) {
      return NextResponse.json({
        success: false,
        message: "LLM could not generate valid contact data. Fallback to /api/scrape.",
        fallback: true,
        debug: {
          domainFound: domain,
          llmResponse: adminsText?.substring(0, 200) + "..."
        }
      });
    }

    // Step 4: Insert into Supabase
    const formatted = admins.map((a) => ({
      name: a.name || "Unknown",
      role: a.role || "Housing Staff",
      email: a.email,
      phone: a.phone ?? null,
      source_url: a.source_url ?? `https://${domain}/housing`,
      status: "todo",
      university_id: university.id,
    }));

    const { error } = await supabase.from("administrators").insert(formatted);
    if (error) throw new Error(error.message);

    return NextResponse.json({
      success: true,
      university,
      inserted: formatted.length,
      admins: formatted,
      method: "llm_generated",
      note: "These are AI-generated likely contacts based on university patterns. Verify accuracy."
    });
    
  } catch (err: any) {
    console.error("API Error:", err);
    return NextResponse.json({ 
      error: err.message,
      fallback: true 
    }, { status: 500 });
  }
}