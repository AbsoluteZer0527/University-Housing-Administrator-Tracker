import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import axios from "axios";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const HOUSING_KEYWORDS = [
  "housing",
  "residence",
  "residential",
  "dormitory",
  "dorm",
  "student housing",
  "on-campus",
  "off-campus",
  "residential life",
  "living",
  "accommodation"
];

const ADMIN_TITLES = [
  "director",
  "coordinator",
  "manager",
  "administrator",
  "assistant",
  "associate",
  "supervisor",
  "dean",
  "staff"
];

function extractEmails(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex);
  
  if (!matches) return [];
  
  return Array.from(new Set(matches))
    .filter(email => {
      // Filter out invalid emails
      const domain = email.split('@')[1]?.toLowerCase();
      const localPart = email.split('@')[0]?.toLowerCase();
      
      // Skip if it's likely a file extension or invalid format
      if (email.includes('.png') || email.includes('.jpg') || 
          email.includes('.gif') || email.includes('.pdf') ||
          email.includes('.doc') || email.includes('.zip')) {
        return false;
      }
      
      // Skip generic/automated emails that aren't real contacts
      const invalidLocalParts = [
        'noreply', 'no-reply', 'donotreply', 'do-not-reply',
        'automated', 'system', 'admin', 'webmaster', 'postmaster',
        'unsubscribe', 'newsletter', 'marketing', 'support',
        'info', 'contact', 'help', 'service', 'sales',
        'signup', 'sign-up', 'register', 'registration'
      ];
      
      if (invalidLocalParts.some(invalid => localPart.includes(invalid))) {
        return false;
      }
      
      // Must be from an .edu domain or recognizable institution
      if (!domain.endsWith('.edu') && !domain.endsWith('.org') && 
          !domain.endsWith('.gov')) {
        return false;
      }
      
      // Basic email format validation
      if (email.length < 5 || email.length > 100) {
        return false;
      }
      
      return true;
    });
}

function extractPhones(text: string): string[] {
  const matches = text.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g);
  return matches ? Array.from(new Set(matches)) : [];
}

function extractNameAndTitle($section: cheerio.Cheerio<any>, email: string): { name: string; title: string | undefined } {
  const text = $section.text();
  const lines = text.split("\n").map(line => line.trim()).filter(Boolean);
  let name = "";
  let title = undefined;

  // Look for patterns around the email
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(email)) {
      // Try to find name in nearby lines
      for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 3); j++) {
        if (j === i) continue; // Skip the line with email
        
        const candidate = lines[j];
        if (!candidate || candidate.length < 2 || candidate.length > 50) continue;
        
        // Check if it looks like a name
        if (isValidName(candidate) && !candidate.includes('@')) {
          name = candidate;
          
          // Look for title in adjacent lines
          if (j > 0 && isValidTitle(lines[j - 1])) {
            title = lines[j - 1];
          } else if (j < lines.length - 1 && isValidTitle(lines[j + 1])) {
            title = lines[j + 1];
          }
          break;
        }
      }
      break;
    }
  }

  return { name, title };
}

function isValidName(candidate: string): boolean {
  // Must contain letters and be reasonable length
  if (!/[a-zA-Z]/.test(candidate) || candidate.length < 2 || candidate.length > 50) {
    return false;
  }
  
  // Should look like a person's name (letters, spaces, common punctuation)
  if (!/^[a-zA-Z\s.,'-]+$/.test(candidate)) {
    return false;
  }
  
  // Skip common non-name patterns
  const invalidPatterns = [
    /^\d+$/, // Just numbers
    /^[A-Z\s]+$/, // All caps (likely headers)
    /equal housing/i,
    /copyright/i,
    /sign.up/i,
    /contact/i,
    /information/i,
    /department/i,
    /university/i,
    /college/i,
    /program/i,
    /service/i,
    /office/i,
    /housing/i,
    /residential/i
  ];
  
  return !invalidPatterns.some(pattern => pattern.test(candidate));
}

function isValidTitle(candidate: string): boolean {
  if (!candidate || candidate.length < 3 || candidate.length > 100) {
    return false;
  }
  
  // Look for common title indicators
  const titleKeywords = [
    'director', 'coordinator', 'manager', 'administrator', 
    'assistant', 'associate', 'supervisor', 'dean', 'staff',
    'specialist', 'advisor', 'counselor', 'officer'
  ];
  
  return titleKeywords.some(keyword => 
    candidate.toLowerCase().includes(keyword)
  );
}

function extractDomainFromDuckDuckGoLink(link: string): string | null {
  try {
    // Handle DuckDuckGo redirect links
    if (link.includes('duckduckgo.com/l/')) {
      const urlMatch = link.match(/uddg=([^&]+)/);
      if (urlMatch) {
        const decodedUrl = decodeURIComponent(urlMatch[1]);
        const url = new URL(decodedUrl);
        return url.hostname;
      }
    }
    
    // Handle direct links
    const url = new URL(link.startsWith('http') ? link : 'https://' + link);
    return url.hostname;
  } catch {
    return null;
  }
}

function extractFullUrlFromDuckDuckGoLink(link: string): string | null {
  try {
    // Handle DuckDuckGo redirect links
    if (link.includes('duckduckgo.com/l/')) {
      const urlMatch = link.match(/uddg=([^&]+)/);
      if (urlMatch) {
        return decodeURIComponent(urlMatch[1]);
      }
    }
    
    // Handle direct links
    return link.startsWith('http') ? link : 'https://' + link;
  } catch {
    return null;
  }
}

function normalizeUniversityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

function generateUniversityVariations(universityName: string): string[] {
  const normalized = normalizeUniversityName(universityName);
  const variations = new Set([universityName, normalized]);
  
  // Common abbreviations and variations
  const abbreviations: { [key: string]: string[] } = {
    'university of california': ['uc', 'university of california'],
    'california state university': ['csu', 'cal state'],
    'state university': ['state', 'university'],
    'college': ['college', 'university'],
    'institute of technology': ['tech', 'institute of technology', 'it'],
    'community college': ['cc', 'community college']
  };

  // Add common variations
  let modifiedName = normalized;
  for (const [full, abbrevs] of Object.entries(abbreviations)) {
    if (modifiedName.includes(full)) {
      abbrevs.forEach(abbrev => {
        variations.add(modifiedName.replace(full, abbrev));
      });
    }
  }

  // Remove common words that might cause confusion
  const commonWords = ['the', 'of', 'at', 'in', 'and', '&'];
  const wordsRemoved = normalized.split(' ').filter(word => !commonWords.includes(word)).join(' ');
  if (wordsRemoved !== normalized) {
    variations.add(wordsRemoved);
  }

  // Add acronym version (first letters of each word)
  const words = normalized.split(' ').filter(word => word.length > 2);
  if (words.length > 1) {
    const acronym = words.map(word => word[0]).join('');
    if (acronym.length >= 2) {
      variations.add(acronym);
    }
  }

  return Array.from(variations);
}

async function findExistingUniversity(universityName: string): Promise<any | null> {
  const nameVariations = generateUniversityVariations(universityName);
  console.log(`🔍 Checking for existing university with variations:`, nameVariations);

  for (const variation of nameVariations) {
    const { data: existing, error } = await supabase
      .from("universities")
      .select("*")
      .ilike("name", `%${variation}%`)
      .limit(1);

    if (!error && existing && existing.length > 0) {
      return existing[0];
    }
  }

  return null;
}

async function createUniversity(universityName: string, domain: string | null): Promise<any> {
  console.log(`➕ Creating new university: ${universityName}`);
  
  const newUniversity = {
    name: universityName,
    website: domain ? `https://${domain}` : null
  };

  const { data: created, error: createError } = await supabase
    .from("universities")
    .insert(newUniversity)
    .select()
    .single();

  if (createError) {
    throw new Error(`Failed to create university "${universityName}": ${createError.message}`);
  }

  if (!created) {
    throw new Error(`University creation returned no data for: ${universityName}`);
  }

  console.log(`✅ Created new university: ${created.name} (ID: ${created.id})`);
  return created;
}

function scoreAndFilterAdministrators(admins: HousingAdmin[]): HousingAdmin[] {
  console.log(`📊 Scoring ${admins.length} administrators for relevance...`);
  
  const scoredAdmins = admins.map(admin => {
    let score = 0;
    const email = admin.email.toLowerCase();
    const name = admin.admin_name.toLowerCase();
    const title = admin.title.toLowerCase();
    
    // Email domain scoring (higher score for university domains)
    if (email.includes('.edu')) score += 10;
    
    // Housing-specific keywords in email
    const housingEmailKeywords = ['housing', 'residential', 'residence', 'dorm', 'hdh'];
    housingEmailKeywords.forEach(keyword => {
      if (email.includes(keyword)) score += 15;
    });
    
    // Title relevance scoring
    const highValueTitles = ['director', 'coordinator', 'manager', 'administrator'];
    const mediumValueTitles = ['assistant', 'associate', 'specialist', 'advisor'];
    const housingTitles = ['housing', 'residential', 'residence'];
    
    highValueTitles.forEach(keyword => {
      if (title.includes(keyword)) score += 20;
    });
    mediumValueTitles.forEach(keyword => {
      if (title.includes(keyword)) score += 10;
    });
    housingTitles.forEach(keyword => {
      if (title.includes(keyword)) score += 25;
    });
    
    // Name validation (penalty for suspicious names)
    if (name.length < 3 || name.length > 50) score -= 20;
    if (/^\d+$/.test(name)) score -= 50; // Just numbers
    if (name.includes('copyright') || name.includes('equal housing')) score -= 50;
    
    // Email validation (penalty for suspicious emails)
    if (email.includes('png') || email.includes('jpg')) score -= 100;
    if (email.includes('noreply') || email.includes('donotreply')) score -= 50;
    if (email.includes('signup') || email.includes('unsubscribe')) score -= 50;
    
    return { ...admin, relevance_score: score };
  });
  
  // Filter out admins with negative or very low scores
  const filtered = scoredAdmins.filter(admin => admin.relevance_score > 0);
  
  // Sort by relevance score (highest first)
  filtered.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
  
  console.log(`✅ Filtered to ${filtered.length} relevant administrators`);
  filtered.forEach(admin => {
    console.log(`   📋 ${admin.admin_name} (${admin.email}) - Score: ${admin.relevance_score}`);
  });
  
  return filtered;
}

function removeDuplicateAdmins(admins: HousingAdmin[]): HousingAdmin[] {
  const seen = new Set<string>();
  return admins.filter(admin => {
    const key = `${admin.email.toLowerCase()}-${normalizeUniversityName(admin.admin_name)}`;
    if (seen.has(key)) {
      console.log(`⏭️ Removing duplicate: ${admin.admin_name} (${admin.email})`);
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function checkForDuplicateAdministrators(universityId: string, admins: HousingAdmin[]): Promise<HousingAdmin[]> {
  console.log(`🔍 Checking for duplicate administrators...`);
  
  // Get existing administrators for this university
  const { data: existingAdmins, error } = await supabase
    .from("administrators")
    .select("email, name")
    .eq("university_id", universityId);

  if (error) {
    console.warn(`⚠️ Could not check for existing administrators:`, error.message);
    return admins; // Return all admins if we can't check
  }

  const existingEmails = new Set(existingAdmins?.map(admin => admin.email.toLowerCase()) || []);
  const existingNames = new Set(existingAdmins?.map(admin => normalizeUniversityName(admin.name)) || []);

  // Filter out duplicates
  const newAdmins = admins.filter(admin => {
    const emailExists = existingEmails.has(admin.email.toLowerCase());
    const nameExists = existingNames.has(normalizeUniversityName(admin.admin_name));
    
    if (emailExists) {
      console.log(`⏭️ Skipping duplicate email: ${admin.email}`);
      return false;
    }
    
    if (nameExists) {
      console.log(`⏭️ Skipping duplicate name: ${admin.admin_name}`);
      return false;
    }
    
    return true;
  });

  console.log(`📊 Filtered ${admins.length - newAdmins.length} duplicates, ${newAdmins.length} new administrators`);
  return newAdmins;
}

async function guessUniversityDomain(universityName: string): Promise<string | null> {
  const query = `${universityName} site:.edu`;
  console.log("🔍 Searching for university domain with query:", query);

  try {
    const res = await axios.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      timeout: 15000,
    });

    const $ = cheerio.load(res.data);
    const domains = new Set<string>();

    // Extract domains from search results
    $("a[href*='.edu']").each((_, el) => {
      const href = $(el).attr("href");
      if (href) {
        const domain = extractDomainFromDuckDuckGoLink(href);
        if (domain && domain.endsWith('.edu')) {
          domains.add(domain);
        }
      }
    });

    const uniqueDomains = Array.from(domains);
    console.log("🔗 Found .edu domains:", uniqueDomains);

    if (uniqueDomains.length === 0) {
      console.warn("⚠️ No domains found from search. Trying fallback strategies.");
      return await tryFallbackDomainStrategies(universityName);
    }

    // Prioritize main university domain (shorter, more likely to be primary)
    const sortedDomains = uniqueDomains.sort((a, b) => a.length - b.length);
    const primaryDomain = sortedDomains[0];
    
    console.log(`✅ Selected domain: ${primaryDomain}`);
    return primaryDomain;

  } catch (err) {
    console.error("❌ Failed to search DuckDuckGo:", err);
    return await tryFallbackDomainStrategies(universityName);
  }
}

async function tryFallbackDomainStrategies(universityName: string): Promise<string | null> {
  console.log("🔄 Trying fallback domain strategies...");
  
  const lowerName = universityName.toLowerCase();
  const fallbackDomains: string[] = [];
  
  // Special handling for UC system
  if (lowerName.includes('university of california')) {
    const cityMatch = lowerName.match(/university of california[,\s]+(.+)/);
    if (cityMatch) {
      const cityPart = cityMatch[1].trim().replace(/[,\s]+/g, '');
      
      // Common UC patterns
      if (cityPart.includes('san diego') || cityPart.includes('sandiego')) {
        fallbackDomains.push('ucsd.edu');
      } else if (cityPart.includes('los angeles') || cityPart.includes('losangeles')) {
        fallbackDomains.push('ucla.edu');
      } else if (cityPart.includes('berkeley')) {
        fallbackDomains.push('berkeley.edu', 'ucberkeley.edu');
      } else if (cityPart.includes('davis')) {
        fallbackDomains.push('ucdavis.edu');
      } else if (cityPart.includes('irvine')) {
        fallbackDomains.push('uci.edu');
      } else if (cityPart.includes('santa barbara')) {
        fallbackDomains.push('ucsb.edu');
      } else if (cityPart.includes('santa cruz')) {
        fallbackDomains.push('ucsc.edu');
      } else if (cityPart.includes('riverside')) {
        fallbackDomains.push('ucr.edu');
      } else if (cityPart.includes('merced')) {
        fallbackDomains.push('ucmerced.edu');
      } else {
        // Generic UC pattern
        const cleanCity = cityPart.replace(/[^a-z]/g, '');
        fallbackDomains.push(`uc${cleanCity}.edu`);
      }
    }
  }
  
  // Special handling for Cal State system
  if (lowerName.includes('california state university') || lowerName.includes('cal state')) {
    const cityMatch = lowerName.match(/(?:california state university|cal state)[,\s]+(.+)/);
    if (cityMatch) {
      const cityPart = cityMatch[1].trim().replace(/[,\s]+/g, '').replace(/[^a-z]/g, '');
      fallbackDomains.push(`csu${cityPart}.edu`, `${cityPart}.edu`);
    }
  }

  // Common domain patterns for other universities
  const nameWords = lowerName
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(word => !['university', 'of', 'the', 'at', 'state', 'college', 'california'].includes(word));

  // If we don't have UC-specific domains, try general patterns
  if (fallbackDomains.length === 0) {
    fallbackDomains.push(
      `${nameWords.join('')}.edu`,
      `${nameWords[0]}.edu`,
      `${nameWords.join('-')}.edu`
    );
    
    if (nameWords.length > 1) {
      fallbackDomains.push(`${nameWords[0]}${nameWords[nameWords.length - 1]}.edu`);
    }
  }

  console.log("🎯 Trying fallback domains:", fallbackDomains);

  // Test each domain
  for (const domain of fallbackDomains) {
    try {
      const testUrl = `https://${domain}`;
      const response = await axios.get(testUrl, { 
        timeout: 5000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        }
      });
      
      if (response.status === 200) {
        console.log(`✅ Found working domain: ${domain}`);
        return domain;
      }
    } catch {
      console.log(`❌ Domain not accessible: ${domain}`);
    }
  }

  console.error("❌ All fallback strategies failed");
  return null;
}

async function searchHousingPages(universityName: string): Promise<string[]> {
  console.log(`🏠 Searching for housing pages for: ${universityName}`);
  
  // Try to get domain first to improve search results
  const domain = await guessUniversityDomain(universityName);
  console.log(`🌐 University domain: ${domain || 'Not found'}`);
  
  const housingQueries = [
    `${universityName} housing contact`,
    `${universityName} housing "contact us"`,
    `${universityName} residential life contact`,
    `${universityName} housing staff directory`,
    `${universityName} housing administration`,
    `${universityName} housing`,
    `${universityName} residential life`,
    `${universityName} student housing`,
    `${universityName} residence hall`,
    `${universityName} dormitory`
  ];

  // Add domain-specific queries if we have a domain
  if (domain) {
    housingQueries.push(
      `site:${domain} housing contact`,
      `site:${domain} "contact us" housing`,
      `site:${domain} residential contact`,
      `site:${domain} housing staff`,
      `site:${domain} housing administration`
    );
  }

  const foundLinks = new Set<string>();

  for (const query of housingQueries) {
    console.log(`🔍 Searching: ${query}`);
    
    try {
      const res = await axios.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
        timeout: 15000,
      });

      const $ = cheerio.load(res.data);
      
      // Extract URLs from search results
      $("a[href]").each((_, el) => {
        const href = $(el).attr("href");
        const text = $(el).text().toLowerCase();
        const title = $(el).attr("title")?.toLowerCase() || "";

        if (!href) return;

        // Check if this looks like a housing-related result
        const hasHousingKeyword = HOUSING_KEYWORDS.some(keyword =>
          text.includes(keyword) || title.includes(keyword)
        );

        if (hasHousingKeyword) {
          const linkDomain = extractDomainFromDuckDuckGoLink(href);
          if (linkDomain && linkDomain.endsWith('.edu')) {
            const fullUrl = extractFullUrlFromDuckDuckGoLink(href);
            if (fullUrl && fullUrl.startsWith('http')) {
              foundLinks.add(fullUrl);
              console.log(`   ✅ Found housing link: ${fullUrl}`);
            }
          }
        }
      });

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (err) {
      console.warn(`⚠️ Failed to search for "${query}":`, err);
    }
  }

  // If we have a domain, try direct paths and subdomains
  if (domain) {
    console.log(`🔍 Trying direct domain patterns for: ${domain}`);
    
    // Try common housing subdomain patterns
    const commonHousingSubdomains = [
      'housing',
      'residential',
      'residence',
      'dorms',
      'hdh', // Housing, Dining, and Hospitality (common for UC system)
      'reslife',
      'housing-hub',
      'student-housing',
      'hdhhousing', // Specific to UCSD
      'hdhhome'     // Specific to UCSD
    ];

    for (const subdomain of commonHousingSubdomains) {
      const testUrl = `https://${subdomain}.${domain}`;
      try {
        const response = await axios.head(testUrl, { 
          timeout: 5000,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          }
        });
        
        if (response.status === 200) {
          foundLinks.add(testUrl);
          console.log(`✅ Found housing subdomain: ${testUrl}`);
        }
      } catch {
        // Subdomain doesn't exist, continue
      }
    }

    // Try common housing URL patterns
    const commonHousingPaths = [
      `https://${domain}/housing/contact`,
      `https://${domain}/housing/contact-us`,
      `https://${domain}/residential-life/contact`,
      `https://${domain}/housing`,
      `https://${domain}/residential-life`,
      `https://${domain}/student-life/housing`,
      `https://${domain}/residence`,
      `https://${domain}/dorms`,
      `https://${domain}/living`,
      `https://${domain}/housing-dining`,
      `https://${domain}/students/housing`
    ];

    for (const url of commonHousingPaths) {
      try {
        const response = await axios.head(url, { 
          timeout: 5000,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          }
        });
        
        if (response.status === 200) {
          foundLinks.add(url);
          console.log(`✅ Found housing path: ${url}`);
        }
      } catch {
        // Path doesn't exist, continue
      }
    }
  }

  const uniqueLinks = Array.from(foundLinks);
  console.log(`🏠 Found ${uniqueLinks.length} housing-related links:`, uniqueLinks);
  return uniqueLinks;
}

async function scrapeHousingAdmins(universityName: string, url: string): Promise<HousingAdmin[]> {
  console.log(`🔍 Scraping housing admins from: ${url}`);
  const admins: HousingAdmin[] = [];

  try {
    const res = await axios.get(url, { 
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      }
    });
    
    const $ = cheerio.load(res.data);

    // First, look for "Contact Us" or "Contact" pages to explore
    const contactLinks = await findContactPages($, url);
    console.log(`📞 Found ${contactLinks.length} contact pages to explore`);

    // Scrape the main page first
    await scrapePageForAdmins($, universityName, url, admins);

    // Then scrape each contact page
    for (const contactUrl of contactLinks) {
      try {
        console.log(`🔍 Exploring contact page: ${contactUrl}`);
        const contactRes = await axios.get(contactUrl, { 
          timeout: 15000,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          }
        });
        
        const $contact = cheerio.load(contactRes.data);
        await scrapePageForAdmins($contact, universityName, contactUrl, admins);
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (err) {
        console.warn(`⚠️ Failed to scrape contact page ${contactUrl}:`, err);
      }
    }

    console.log(`📊 Total scraped ${admins.length} admins from ${url} and its contact pages`);
    return admins;

  } catch (err) {
    console.error(`❌ Failed to scrape ${url}:`, err);
    throw new Error(`Failed to scrape housing page: ${url}`);
  }
}

async function findContactPages($: cheerio.CheerioAPI, baseUrl: string): Promise<string[]> {
  const contactLinks: string[] = [];
  const contactKeywords = [
    'contact us', 'contact', 'get in touch', 'reach us', 'contact information',
    'staff directory', 'directory', 'administration', 'team', 'staff'
  ];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    const text = $(el).text().toLowerCase().trim();
    const title = $(el).attr("title")?.toLowerCase() || "";

    if (!href) return;

    // Check if link text contains contact-related keywords
    const isContactLink = contactKeywords.some(keyword => 
      text.includes(keyword) || title.includes(keyword) || href.toLowerCase().includes(keyword)
    );

    if (isContactLink) {
      try {
        const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).toString();
        
        // Only include if it's from the same domain
        const baseHost = new URL(baseUrl).hostname;
        const linkHost = new URL(fullUrl).hostname;
        
        if (linkHost === baseHost && !contactLinks.includes(fullUrl)) {
          contactLinks.push(fullUrl);
          console.log(`   📞 Found contact link: ${text} → ${fullUrl}`);
        }
      } catch (err) {
        // Invalid URL, skip
      }
    }
  });

  return contactLinks.slice(0, 5); // Limit to 5 contact pages to avoid too many requests
}

async function scrapePageForAdmins($: cheerio.CheerioAPI, universityName: string, url: string, admins: HousingAdmin[]): Promise<void> {
  // Look for staff/contact sections
  const staffSections = $("div, section, article, main, .staff, .contact, .directory, .personnel, .team").filter((_, el) => {
    const text = $(el).text().toLowerCase();
    const hasHousingKeyword = HOUSING_KEYWORDS.some(kw => text.includes(kw));
    const hasAdminTitle = ADMIN_TITLES.some(title => text.includes(title));
    const hasEmail = text.includes('@');
    
    return (hasHousingKeyword || hasAdminTitle || hasEmail) && text.length > 50; // Ensure substantial content
  });

  console.log(`📋 Found ${staffSections.length} potential staff sections on ${url}`);

  staffSections.each((_, section) => {
    const $section = $(section);
    const sectionText = $section.text();
    const emails = extractEmails(sectionText);
    const phones = extractPhones(sectionText);

    emails.forEach(email => {
      const { name, title, isContactForm } = extractContactInfo($section, email);

      if (email && (name || isContactForm)) {
        const admin: HousingAdmin = {
          university_name: universityName,
          admin_name: name || "Contact Form",
          title: title || (isContactForm ? "Contact via form" : "Housing Staff"),
          email: isContactForm ? "contact-form" : email,
          phone: phones[0] ?? undefined,
          department: "Housing",
          scraped_at: new Date().toISOString(),
          source_url: url
        };

        // Add contact form description if applicable
        if (isContactForm) {
          admin.title = `Contact form available - Original email: ${email}`;
        }

        admins.push(admin);
        console.log(`✅ Found admin: ${admin.admin_name} (${admin.email})`);
      }
    });
  });

  // Look for structured contact information (like the UCSD example)
  await extractStructuredContacts($, universityName, url, admins);
}

async function extractStructuredContacts($: cheerio.CheerioAPI, universityName: string, url: string, admins: HousingAdmin[]): Promise<void> {
  // Look for patterns like "Department Name: Phone Number Email"
  const textContent = $.text();
  const lines = textContent.split('\n').map(line => line.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const emails = extractEmails(line);
    const phones = extractPhones(line);

    if (emails.length > 0 && (phones.length > 0 || line.length > 20)) {
      emails.forEach(email => {
        // Look for department/service name in the same line or nearby lines
        let departmentName = "";
        let phoneNumber = phones[0] || undefined;

        // Try to extract department name from current line
        const beforeEmail = line.split(email)[0].trim();
        if (beforeEmail && beforeEmail.length > 5 && beforeEmail.length < 100) {
          // Remove phone numbers from department name
          departmentName = beforeEmail.replace(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '').trim();
          // Remove common separators
          departmentName = departmentName.replace(/[:\-•]$/, '').trim();
        }

        // If no department name found, look in nearby lines
        if (!departmentName) {
          for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 2); j++) {
            if (j !== i && lines[j] && !lines[j].includes('@') && lines[j].length > 5 && lines[j].length < 100) {
              const candidate = lines[j].replace(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '').trim();
              if (candidate && isValidDepartmentName(candidate)) {
                departmentName = candidate;
                break;
              }
            }
          }
        }

        if (departmentName || phoneNumber) {
          const admin: HousingAdmin = {
            university_name: universityName,
            admin_name: departmentName || "Housing Contact",
            title: determineTitleFromDepartment(departmentName),
            email: email,
            phone: phoneNumber,
            department: "Housing",
            scraped_at: new Date().toISOString(),
            source_url: url
          };

          admins.push(admin);
          console.log(`✅ Found structured contact: ${admin.admin_name} (${admin.email})`);
        }
      });
    }
  }
}

function extractContactInfo($section: cheerio.Cheerio<any>, email: string): { name: string; title: string | undefined; isContactForm: boolean } {
  const text = $section.text();
  const sectionHtml = $section.html() || "";
  
  // Check if this is a contact form
  const isContactForm = sectionHtml.includes('<form') || 
                       sectionHtml.includes('type="submit"') ||
                       text.toLowerCase().includes('submit') ||
                       text.toLowerCase().includes('send message') ||
                       text.toLowerCase().includes('contact form');

  if (isContactForm) {
    return { name: "", title: undefined, isContactForm: true };
  }

  const lines = text.split("\n").map(line => line.trim()).filter(Boolean);
  let name = "";
  let title = undefined;

  // Look for patterns around the email
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(email)) {
      // Try to find name in nearby lines
      for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 3); j++) {
        if (j === i) continue; // Skip the line with email
        
        const candidate = lines[j];
        if (!candidate || candidate.length < 2 || candidate.length > 50) continue;
        
        // Check if it looks like a name
        if (isValidName(candidate) && !candidate.includes('@')) {
          name = candidate;
          
          // Look for title in adjacent lines
          if (j > 0 && isValidTitle(lines[j - 1])) {
            title = lines[j - 1];
          } else if (j < lines.length - 1 && isValidTitle(lines[j + 1])) {
            title = lines[j + 1];
          }
          break;
        }
      }
      break;
    }
  }

  return { name, title, isContactForm: false };
}

function isValidDepartmentName(candidate: string): boolean {
  if (!candidate || candidate.length < 5 || candidate.length > 100) {
    return false;
  }

  // Should contain housing-related or administrative keywords
  const validKeywords = [
    'housing', 'residential', 'residence', 'administration', 'services',
    'dining', 'maintenance', 'custodial', 'student', 'office', 'department'
  ];

  return validKeywords.some(keyword => 
    candidate.toLowerCase().includes(keyword)
  );
}

function determineTitleFromDepartment(departmentName: string): string {
  if (!departmentName) return "Housing Contact";
  
  const lower = departmentName.toLowerCase();
  
  if (lower.includes('administration')) return "Housing Administration";
  if (lower.includes('services')) return "Housing Services";
  if (lower.includes('dining')) return "Dining Services";
  if (lower.includes('maintenance')) return "Maintenance Services";
  if (lower.includes('director')) return "Director";
  if (lower.includes('coordinator')) return "Coordinator";
  if (lower.includes('manager')) return "Manager";
  
  return `${departmentName} Contact`;
}

export async function POST(req: Request) {
  const { universityName } = await req.json();
  
  if (!universityName) {
    return NextResponse.json({ 
      success: false,
      message: "Missing universityName parameter" 
    }, { status: 400 });
  }

  console.log(`🎯 Starting scrape for: ${universityName}`);

  try {
    // Step 0: Check if university already exists (before any scraping)
    console.log(`🔍 Checking if university already exists...`);
    const existingUniversity = await findExistingUniversity(universityName);
    
    if (existingUniversity) {
      console.log(`✅ Found existing university: ${existingUniversity.name} (ID: ${existingUniversity.id})`);
      
      // Check if we already have administrators for this university
      const { data: existingAdmins, error: adminError } = await supabase
        .from("administrators")
        .select("*")
        .eq("university_id", existingUniversity.id);

      if (!adminError && existingAdmins && existingAdmins.length > 0) {
        return NextResponse.json({ 
          success: true,
          university: existingUniversity,
          admins: existingAdmins,
          message: `University "${universityName}" already exists with ${existingAdmins.length} administrators. Skipping scrape.`,
          existing: true,
          suggestion: "If you want to rescrape, please delete the existing university first or use a different name variation."
        });
      }
    }

    // Step 1: Find housing pages (only if university doesn't exist or has no admins)
    const housingPages = await searchHousingPages(universityName);
    
    if (housingPages.length === 0) {
      return NextResponse.json({ 
        success: false,
        message: `No housing pages found for ${universityName}. The university website might not have easily discoverable housing information.`,
        housing_pages_found: [],
        suggestion: "Try checking the university's website manually or provide a direct housing page URL."
      }, { status: 404 });
    }

    console.log(`📄 Found ${housingPages.length} housing pages to scrape`);

    // Step 2: Scrape administrators from each page
    const allAdmins: HousingAdmin[] = [];
    const errors: string[] = [];

    for (const url of housingPages) {
      try {
        const admins = await scrapeHousingAdmins(universityName, url);
        allAdmins.push(...admins);
      } catch (err: any) {
        const errorMsg = `Failed to scrape ${url}: ${err.message}`;
        console.warn(`⚠️ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    if (allAdmins.length === 0) {
      return NextResponse.json({ 
        success: false,
        message: `No administrators found from ${housingPages.length} housing pages for ${universityName}.`,
        housing_pages_found: housingPages,
        errors: errors,
        suggestion: "The housing pages might not contain contact information, or the page structure might be different than expected."
      }, { status: 404 });
    }

    // Step 3: Score and filter administrators by relevance
    const scoredAdmins = scoreAndFilterAdministrators(allAdmins);
    
    if (scoredAdmins.length === 0) {
      return NextResponse.json({ 
        success: false,
        message: `Found ${allAdmins.length} potential contacts, but none appear to be relevant housing administrators.`,
        housing_pages_found: housingPages,
        suggestion: "The contacts found may be general university contacts rather than housing-specific staff."
      }, { status: 404 });
    }

    // Step 4: Save to database
    const domain = await guessUniversityDomain(universityName);
    const university = existingUniversity || await createUniversity(universityName, domain);

    // Remove duplicates based on email within the scraped data
    const uniqueAdmins = removeDuplicateAdmins(scoredAdmins);

    // Check for duplicates against existing database records
    const newAdmins = await checkForDuplicateAdministrators(university.id, uniqueAdmins);

    if (newAdmins.length === 0) {
      return NextResponse.json({ 
        success: true,
        university: university,
        admins: [],
        message: `All ${uniqueAdmins.length} administrators already exist in the database for ${universityName}`,
        housing_pages_found: housingPages,
        skipped_duplicates: uniqueAdmins.length
      });
    }

    const inserted = await supabase
      .from("administrators")
      .insert(newAdmins.map(admin => ({
        name: admin.admin_name,
        role: admin.title,
        email: admin.email,
        phone: admin.phone ?? null,
        source_url: admin.source_url ?? null,
        status: "not_contacted", // Keep the original status value
        university_id: university.id
      })));

    if (inserted.error) {
      throw new Error(`Database error: Failed to insert administrators: ${inserted.error.message}`);
    }

    console.log(`✅ Successfully inserted ${newAdmins.length} new administrators`);

    return NextResponse.json({
      success: true,
      university: university,
      admins: newAdmins,
      message: `Successfully scraped ${newAdmins.length} relevant administrators from ${housingPages.length} housing pages`,
      housing_pages_found: housingPages, // All discovered housing pages
      total_found: allAdmins.length,
      filtered_relevant: scoredAdmins.length,
      new_inserted: newAdmins.length,
      skipped_duplicates: uniqueAdmins.length - newAdmins.length,
      warnings: errors.length > 0 ? errors : undefined,
      scraping_details: {
        pages_scraped: housingPages.length,
        total_contacts_found: allAdmins.length,
        relevant_contacts: scoredAdmins.length,
        duplicates_removed: uniqueAdmins.length - newAdmins.length,
        final_inserted: newAdmins.length
      }
    });

  } catch (err: any) {
    console.error("❌ Scraping failed:", err);
    
    // Provide more specific error messages
    let errorMessage = "Scraping failed";
    let statusCode = 500;
    
    if (err.message.includes("Could not determine university domain")) {
      errorMessage = `Could not find the official website for "${universityName}". Please check the university name spelling.`;
      statusCode = 404;
    } else if (err.message.includes("Failed to access university website")) {
      errorMessage = `Found the university domain but could not access the website. The site might be down or have access restrictions.`;
      statusCode = 503;
    } else if (err.message.includes("Database error")) {
      errorMessage = `Database operation failed: ${err.message}`;
      statusCode = 500;
    } else {
      errorMessage = `Unexpected error: ${err.message}`;
    }

    return NextResponse.json({ 
      success: false,
      message: errorMessage,
      error: err.message,
      university_name: universityName
    }, { status: statusCode });
  }
}

type HousingAdmin = {
  university_name: string;
  admin_name: string;
  title: string;
  email: string;
  phone?: string;
  department?: string;
  scraped_at: string;
  source_url?: string;
  relevance_score?: number;
};