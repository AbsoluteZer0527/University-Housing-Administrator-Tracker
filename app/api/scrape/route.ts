import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import type { AnyNode } from "domhandler";
import { POST as llmScrape } from "../llmscrape/route";

import axios from "axios";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Enhanced Constants with Research-Based Patterns
const HOUSING_KEYWORDS = [
  "housing", "residence", "residential", "dormitory", "dorm", "student housing",
  "off-campus", "residential life", "campus life", "community life", "living",
  "accommodation", "help-desk", "off-campus-housing", "hdh", "reslife"
];

const ADMIN_TITLES = [
  "director", "coordinator", "manager", "administrator", "assistant",
  "associate", "supervisor", "staff", "specialist", "advisor", "counselor", 
  "officer", "dean", "associate dean", "assistant director", "program coordinator"
];

// Research-Based URL Patterns (40% use staff-directory, 25% about-us/staff, etc.)
const STAFF_DIRECTORY_PATTERNS = [
  '/staff-directory/',
  '/staff-directory',
  '/about-us/staff-directory/',
  '/about-us/staff',
  '/staff/',
  '/staff',
  '/people/',
  '/people',
  '/team/',
  '/team',
  '/directory/',
  '/directory',
  '/administration/',
  '/administration',
  '/personnel/',
  '/contact/',
  '/our-team/',
  '/meet-the-staff/',
  '/faculty-staff/',
  '/leadership/',
  '/management/'
];

const HOUSING_SUBDOMAIN_PATTERNS = [
  'housing', 'residential', 'residence', 'dorms', 'hdh', 'reslife',
  'housing-hub', 'student-housing', 'hdhhousing', 'hdhhome', 'studenthousing'
];

const CONTACT_KEYWORDS = [
  'contact us', 'contact', 'get in touch', 'staff directory', 'directory',
  'administration', 'team', 'staff', 'communities', 'residential communities',
  'housing communities', 'residence halls', 'meet the staff', 'our team',
  'faculty staff', 'leadership', 'management', 'personnel', 'about us'
];

// Location-based patterns for distributed staff organization
const LOCATION_KEYWORDS = [
  'apartments', 'residence halls', 'residential areas', 'communities',
  'north campus', 'south campus', 'east campus', 'west campus',
  'graduate housing', 'undergraduate housing', 'family housing',
  'off-campus', 'university apartments', 'residential colleges',
  'living areas', 'housing complexes', 'dormitories', 'suites',
  'residential communities', 'housing communities', 'residence life'
];

const LOCATION_PATTERNS = [
  '/communities/', '/apartments/', '/residence-halls/', '/locations/',
  '/housing-areas/', '/residential-areas/', '/graduate-housing/',
  '/undergraduate-housing/', '/family-housing/', '/off-campus/',
  '/north-campus/', '/south-campus/', '/east-campus/', '/west-campus/',
  '/living/', '/dormitories/', '/suites/', '/complexes/'
];

// Enhanced CSS Selectors Based on Research
const STAFF_SECTION_SELECTORS = [
  '.staff-grid', '.staff-card', '.staff-list', '.staff-item',
  '.person', '.personnel', '.team-member', '.staff-member',
  '.directory-entry', '.contact-card', '.profile-card',
  '[itemtype*="Person"]', '[class*="staff"]', '[class*="team"]',
  '[class*="person"]', '[class*="contact"]', '[class*="directory"]'
];

const STRUCTURED_DATA_SELECTORS = [
  '[itemscope][itemtype*="Person"]',
  '[data-person]', '[data-staff]', '[data-contact]',
  '.vcard', '.h-card', // Microformats
  '[typeof="Person"]' // RDFa
];

// Timeout Configuration
const SCRAPING_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const BATCH_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes per batch of pages

// Types
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

type University = {
  id: string;
  name: string;
  website?: string | null;
};

// Enhanced Axios Config with Better Headers
const axiosConfig = {
  timeout: 30000, // Increased for slow-loading JS sites
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
  }
};

// Utility Functions (Enhanced)
function extractEmails(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex) || [];
  
  return Array.from(new Set(matches)).filter(email => {
    return email.length >= 5 && email.length <= 100 &&
           !['png', 'jpg', 'gif', 'pdf', 'doc', 'zip', 'jpeg', 'svg'].some(ext => email.includes(`.${ext}`)) &&
           !['noreply', 'no-reply', 'donotreply', 'mailer-daemon'].some(invalid => email.toLowerCase().includes(invalid));
  });
}

function extractPhones(text: string): string[] {
  // Enhanced phone regex for various formats
  const phoneRegexes = [
    /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    /\d{3}-\d{3}-\d{4}/g,
    /\(\d{3}\)\s?\d{3}-\d{4}/g,
    /\d{3}\.\d{3}\.\d{4}/g
  ];
  
  const phones = new Set<string>();
  phoneRegexes.forEach(regex => {
    const matches = text.match(regex) || [];
    matches.forEach(phone => phones.add(phone));
  });
  
  return Array.from(phones);
}

function isValidName(candidate: string): boolean {
  if (!candidate || candidate.length < 2 || candidate.length > 60) return false;
  if (!/[a-zA-Z]/.test(candidate) || !/^[a-zA-Z\s.,'-]+$/.test(candidate)) return false;
  
  const invalidPatterns = [
    /^\d+$/, /^[A-Z\s]+$/, /equal housing/i, /copyright/i, /sign.?up/i,
    /contact/i, /information/i, /department/i, /university/i, /college/i,
    /program/i, /service/i, /office/i, /housing/i, /residential/i,
    /phone/i, /email/i, /fax/i, /address/i, /location/i, /hours/i
  ];
  
  return !invalidPatterns.some(pattern => pattern.test(candidate));
}

function isValidTitle(candidate: string): boolean {
  return typeof candidate === "string" &&
         candidate.length >= 3 &&
         candidate.length <= 150 &&
         ADMIN_TITLES.some(keyword => candidate.toLowerCase().includes(keyword));
}

function normalizeUniversityName(name: string): string {
  return name.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

// NEW: Database-specific normalization (more aggressive than search normalization)
function normalizeUniversityNameForDatabase(name: string): string {
  return name.toLowerCase()
    .replace(/[,\-\.]/g, '') // Remove commas, dashes, periods
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\bthe\b/g, '') // Remove "the"
    .replace(/\buniversity of\b/g, 'university of') // Normalize "university of"
    .replace(/\bcalifornia institute of technology\b/g, 'california institute of technology')
    .trim();
}

// NEW: Add global URL tracking
class URLTracker {
  private scrapedUrls = new Set<string>();
  private discoveredEmails = new Set<string>();
  
  normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }
  
  hasBeenScraped(url: string): boolean {
    return this.scrapedUrls.has(this.normalizeUrl(url));
  }
  
  markAsScraped(url: string): void {
    this.scrapedUrls.add(this.normalizeUrl(url));
  }
  
  hasEmail(email: string): boolean {
    return this.discoveredEmails.has(email.toLowerCase());
  }
  
  addEmail(email: string): void {
    this.discoveredEmails.add(email.toLowerCase());
  }
}

function generateUniversityVariations(universityName: string): string[] {
  const normalized = normalizeUniversityName(universityName);
  const variations = new Set([universityName, normalized]);
  
  // NEW: California universities only
  const californiaUniversities: { [key: string]: string[] } = {
    // Major California Tech Schools
    'california institute of technology': ['caltech', 'cit'],
    'caltech': ['california institute of technology', 'cit'],
    
    // Stanford
    'stanford university': ['stanford'],
    'stanford': ['stanford university'],
    
    // USC
    'university of southern california': ['usc'],
    'usc': ['university of southern california'],
    
    // Claremont Colleges
    'harvey mudd college': ['harvey mudd', 'hmc'],
    'pomona college': ['pomona'],
    'claremont mckenna college': ['claremont mckenna', 'cmc'],
    'scripps college': ['scripps'],
    'pitzer college': ['pitzer'],
    
    // UC System
    'university of california berkeley': ['uc berkeley', 'ucb', 'berkeley', 'cal'],
    'university of california los angeles': ['ucla', 'uc los angeles'],
    'university of california san diego': ['ucsd', 'uc san diego'],
    'university of california irvine': ['uci', 'uc irvine'],
    'university of california davis': ['ucd', 'uc davis'],
    'university of california santa barbara': ['ucsb', 'uc santa barbara'],
    'university of california riverside': ['ucr', 'uc riverside'],
    'university of california santa cruz': ['ucsc', 'uc santa cruz'],
    'university of california merced': ['ucm', 'uc merced'],
    'university of california san francisco': ['ucsf', 'uc san francisco'],
    
    // Cal State System  
    'california state university long beach': ['cal state long beach', 'csulb'],
    'california state university los angeles': ['cal state la', 'csula'],
    'california state university fullerton': ['cal state fullerton', 'csuf'],
    'california state university northridge': ['cal state northridge', 'csun'],
    'california state university san diego': ['sdsu', 'san diego state'],
    'san diego state university': ['sdsu', 'cal state san diego'],
    'california state university fresno': ['fresno state', 'csuf'],
    'california state university sacramento': ['sac state', 'csus'],
    'california state university san francisco': ['sf state', 'sfsu'],
    'san francisco state university': ['sf state', 'sfsu'],
    
    // Other California Schools
    'california polytechnic state university': ['cal poly', 'calpoly'],
    'cal poly': ['california polytechnic state university', 'calpoly'],
    'california polytechnic pomona': ['cal poly pomona', 'cpp'],
    'university of california hastings': ['uc hastings'],
    'loyola marymount university': ['lmu'],
    'pepperdine university': ['pepperdine'],
    'santa clara university': ['santa clara', 'scu'],
    'university of san francisco': ['usf'],
    'san jose state university': ['sjsu', 'san jose state'],
    'humboldt state university': ['humboldt state', 'hsu'],
  };

  const lowerInput = universityName.toLowerCase();
  
  // Check if input matches any California university
  // Check if input matches any California university (exact or specific campus match)
// Smart matching for California universities
// First, try exact matches (input matches full name or abbreviation)
let matched = false;

for (const [fullName, abbreviations] of Object.entries(californiaUniversities)) {
  // Check if input exactly matches the full name
  if (lowerInput === fullName) {
    abbreviations.forEach(abbrev => {
      variations.add(abbrev);
      variations.add(abbrev.toUpperCase());
    });
    variations.add(fullName);
    matched = true;
    break;
  }
  
  // Check if input exactly matches any abbreviation
  if (abbreviations.some(abbrev => lowerInput === abbrev.toLowerCase())) {
    variations.add(fullName);
    abbreviations.forEach(abbrev => {
      variations.add(abbrev);
      variations.add(abbrev.toUpperCase());
    });
    matched = true;
    break;
  }
}

// If no exact match found, try partial matches for UC campuses
if (!matched) {
  for (const [fullName, abbreviations] of Object.entries(californiaUniversities)) {
    // For UC system, check if the campus name appears in input
    if (fullName.startsWith('university of california')) {
      const campus = fullName.replace('university of california ', '');
      
      // Check if input contains the campus name specifically
      if ((lowerInput.includes('university of california') && lowerInput.includes(campus)) ||
          (lowerInput.includes('uc ') && lowerInput.includes(campus)) ||
          (lowerInput === campus)) {
        
        variations.add(fullName);
        abbreviations.forEach(abbrev => {
          variations.add(abbrev);
          variations.add(abbrev.toUpperCase());
        });
        break;
      }
    }
    
    // For non-UC schools, check partial matches
    else {
      const schoolKeywords = fullName.split(' ').filter(word => 
        !['university', 'of', 'california', 'state', 'college', 'institute', 'technology'].includes(word)
      );
      
      if (schoolKeywords.some(keyword => 
          lowerInput.includes(keyword) && keyword.length > 3
      )) {
        variations.add(fullName);
        abbreviations.forEach(abbrev => {
          variations.add(abbrev);
          variations.add(abbrev.toUpperCase());
        });
        break;
      }
    }
  }
}

  // Rest of existing logic for general patterns...
  const abbreviations: { [key: string]: string[] } = {
    'university of california': ['uc', 'university of california'],
    'california state university': ['csu', 'cal state'],
    'state university': ['state', 'university'],
    'college': ['college', 'university'],
    'institute of technology': ['tech', 'institute of technology', 'it'],
    'community college': ['cc', 'community college']
  };

  for (const [full, abbrevs] of Object.entries(abbreviations)) {
    if (normalized.includes(full)) {
      abbrevs.forEach(abbrev => variations.add(normalized.replace(full, abbrev)));
    }
  }

  // Rest of existing logic...
  const commonWords = ['the', 'of', 'at', 'in', 'and', '&'];
  const wordsRemoved = normalized.split(' ').filter(word => !commonWords.includes(word)).join(' ');
  if (wordsRemoved !== normalized) variations.add(wordsRemoved);

  const words = normalized.split(' ').filter(word => word.length > 2);
  if (words.length > 1) {
    const acronym = words.map(word => word[0]).join('');
    if (acronym.length >= 2) variations.add(acronym);
  }

  console.log(`🔍 Generated variations for "${universityName}":`, Array.from(variations));
  return Array.from(variations);
}

// Enhanced Domain Discovery
async function guessUniversityDomain(universityName: string): Promise<string | null> {
  const query = `${universityName} site:.edu`;
  console.log("🔍 Searching for university domain:", query);

  try {
    const res = await axios.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, axiosConfig);
    const $ = cheerio.load(res.data);
    const domains = new Set<string>();

    $("a[href*='.edu']").each((_, el) => {
      const href = $(el).attr("href");
      if (href) {
        const domain = extractDomainFromUrl(href);
        if (domain?.endsWith('.edu')) domains.add(domain);
      }
    });

    const uniqueDomains = Array.from(domains).sort((a, b) => a.length - b.length);
    return uniqueDomains[0] || await tryFallbackDomainStrategies(universityName);
  } catch (err) {
    console.error("❌ Failed to search DuckDuckGo:", err);
    return await tryFallbackDomainStrategies(universityName);
  }
}

function extractDomainFromUrl(url: string): string | null {
  try {
    if (url.includes('duckduckgo.com/l/')) {
      const urlMatch = url.match(/uddg=([^&]+)/);
      if (urlMatch) {
        const decodedUrl = decodeURIComponent(urlMatch[1]);
        return new URL(decodedUrl).hostname;
      }
    }
    return new URL(url.startsWith('http') ? url : 'https://' + url).hostname;
  } catch {
    return null;
  }
}

async function tryFallbackDomainStrategies(universityName: string): Promise<string | null> {
  console.log("🔄 Trying fallback domain strategies...");
  
  const lowerName = universityName.toLowerCase();
  const fallbackDomains: string[] = [];
  
  // NEW: California-only known domains
  const californiaDomains: { [key: string]: string } = {
    'california institute of technology': 'caltech.edu',
    'caltech': 'caltech.edu',
    'stanford university': 'stanford.edu',
    'stanford': 'stanford.edu',
    'university of southern california': 'usc.edu',
    'usc': 'usc.edu',
    'harvey mudd college': 'hmc.edu',
    'harvey mudd': 'hmc.edu',
    'pomona college': 'pomona.edu',
    'pomona': 'pomona.edu',
    'claremont mckenna college': 'cmc.edu',
    'claremont mckenna': 'cmc.edu',
    'scripps college': 'scrippscollege.edu',
    'pitzer college': 'pitzer.edu',
    'california polytechnic state university': 'calpoly.edu',
    'cal poly': 'calpoly.edu',
    'california polytechnic pomona': 'cpp.edu',
    'cal poly pomona': 'cpp.edu',
    'loyola marymount university': 'lmu.edu',
    'pepperdine university': 'pepperdine.edu',
    'santa clara university': 'scu.edu',
    'university of san francisco': 'usfca.edu',
    'san jose state university': 'sjsu.edu',
    'san diego state university': 'sdsu.edu',
    'san francisco state university': 'sfsu.edu',
    'humboldt state university': 'humboldt.edu',
    'university of california santa cruz': 'ucsc.edu',  
    'uc santa cruz': 'ucsc.edu'                     
  };

 // Check California domains first
for (const [name, domain] of Object.entries(californiaDomains)) {
  if (lowerName.includes(name) || name.includes(lowerName)) {
    fallbackDomains.unshift(domain); // Add to front of array
    break;
  }
  }

  // Rest of existing UC and Cal State logic...
  if (lowerName.includes('university of california')) {
    const cityMatch = lowerName.match(/university of california[,\s]+(.+)/);
    if (cityMatch) {
      const city = cityMatch[1].trim().replace(/[,\s]+/g, '');
      const ucDomains: { [key: string]: string } = {
        'san diego': 'ucsd.edu', 'sandiego': 'ucsd.edu',
        'los angeles': 'ucla.edu', 'losangeles': 'ucla.edu',
        'berkeley': 'berkeley.edu', 'davis': 'ucdavis.edu',
        'irvine': 'uci.edu', 'santa barbara': 'ucsb.edu',
        'santa cruz': 'ucsc.edu', 'riverside': 'ucr.edu',
        'merced': 'ucmerced.edu', 'san francisco': 'ucsf.edu'
      };
      
      if (ucDomains[city]) fallbackDomains.push(ucDomains[city]);
      else fallbackDomains.push(`uc${city.replace(/[^a-z]/g, '')}.edu`);
    }
  }
  
  if (lowerName.includes('california state university') || lowerName.includes('cal state')) {
    const cityMatch = lowerName.match(/(?:california state university|cal state)[,\s]+(.+)/);
    if (cityMatch) {
      const city = cityMatch[1].trim().replace(/[,\s]+/g, '').replace(/[^a-z]/g, '');
      fallbackDomains.push(`csu${city}.edu`, `${city}.edu`);
    }
  }

  // Rest of existing logic...
  const nameWords = lowerName.replace(/[^a-z\s]/g, '').split(/\s+/)
    .filter(word => !['university', 'of', 'the', 'at', 'state', 'college', 'california', 'institute', 'technology'].includes(word));

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

  // Test domains with retry logic
  for (const domain of fallbackDomains) {
    try {
      const response = await axios.get(`https://${domain}`, { 
        timeout: 8000, 
        headers: axiosConfig.headers,
        maxRedirects: 3
      });
      if (response.status === 200) {
        console.log(`✅ Found working domain: ${domain}`);
        return domain;
      }
    } catch {
      console.log(`❌ Domain not accessible: ${domain}`);
    }
  }

  return null;
}
// Enhanced Housing Page Discovery
async function searchHousingPages(universityName: string): Promise<string[]> {
  console.log(`🏠 Searching for housing pages: ${universityName}`);
  
  const domain = await guessUniversityDomain(universityName);
  const foundLinks = new Set<string>();

  // Enhanced search queries
  const queries = [
    `${universityName} housing contact`,
    `${universityName} housing staff directory`,
    `${universityName} residential life staff`,
    `${universityName} housing administration`,
    `${universityName} housing communities staff`,
    `${universityName} "staff directory" housing`,
    `${universityName} "meet the staff" housing`,
    `${universityName} housing personnel`
  ];

  if (domain) {
    queries.push(
      `site:${domain} housing staff`,
      `site:${domain} "staff directory"`,
      `site:${domain} housing contact`,
      `site:${domain} residential staff`,
      `site:${domain} housing administration`,
      `site:${domain} housing personnel`,
      `site:${domain} housing team`
    );
  }

  // Search for housing pages with better parsing
  for (const query of queries) {
    try {
      const res = await axios.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, axiosConfig);
      const $ = cheerio.load(res.data);
      
      $("a[href]").each((_, el) => {
        const href = $(el).attr("href");
        const text = $(el).text().toLowerCase();
        const title = $(el).attr("title")?.toLowerCase() || "";
        
        if (href && (HOUSING_KEYWORDS.some(keyword => text.includes(keyword)) || 
                     CONTACT_KEYWORDS.some(keyword => text.includes(keyword) || title.includes(keyword)))) {
          const linkDomain = extractDomainFromUrl(href);
          if (linkDomain?.endsWith('.edu')) {
            const fullUrl = extractFullUrl(href);
            if (fullUrl?.startsWith('http')) {
              foundLinks.add(fullUrl);
            }
          }
        }
      });

      await new Promise(resolve => setTimeout(resolve, 1500)); // Increased delay
    } catch (err) {
      console.warn(`⚠️ Failed to search for "${query}":`, err);
    }
  }

  // Enhanced direct URL testing with systematic directory enumeration
  if (domain) {
    await systematicDirectoryEnumeration(domain, foundLinks);
  }

  const uniqueLinks = Array.from(foundLinks);
  console.log(`🏠 Found ${uniqueLinks.length} housing-related links`);
  return uniqueLinks;
}

// NEW: Systematic Directory Enumeration
async function systematicDirectoryEnumeration(domain: string, foundLinks: Set<string>): Promise<void> {
  console.log(`🔍 Starting systematic directory enumeration for: ${domain}`);
  
  // Test housing subdomains first
  for (const subdomain of HOUSING_SUBDOMAIN_PATTERNS) {
    const subdomainUrl = `https://${subdomain}.${domain}`;
    try {
      const response = await axios.head(subdomainUrl, { 
        timeout: 8000, 
        headers: axiosConfig.headers,
        maxRedirects: 3
      });
      if (response.status === 200) {
        foundLinks.add(subdomainUrl);
        console.log(`✅ Found housing subdomain: ${subdomainUrl}`);
        
        // Test staff directories on found subdomains
        await testStaffDirectoriesOnDomain(subdomainUrl, foundLinks);
      }
    } catch {
      // Subdomain doesn't exist, continue
    }
  }

  // Test main domain staff directories
  await testStaffDirectoriesOnDomain(`https://${domain}`, foundLinks);
}

async function testStaffDirectoriesOnDomain(baseUrl: string, foundLinks: Set<string>): Promise<void> {
  const testPaths = [
    '/housing/staff-directory/',
    '/housing/staff/',
    '/housing/about-us/staff/',
    '/housing/team/',
    '/housing/contact/',
    '/housing/administration/',
    '/residential-life/staff/',
    '/residential-life/staff-directory/',
    '/residential-life/team/',
    '/residential-life/contact/',
    '/housing/communities/staff/',
    '/student-life/housing/staff/',
    ...STAFF_DIRECTORY_PATTERNS.map(path => `/housing${path}`),
    ...STAFF_DIRECTORY_PATTERNS.map(path => `/residential-life${path}`),
    ...STAFF_DIRECTORY_PATTERNS // Direct paths
  ];

  // Enhanced: Add location-based paths for distributed staff
  const locationBasedPaths = [
    ...LOCATION_PATTERNS.map(path => `/housing${path}`),
    ...LOCATION_PATTERNS.map(path => `/residential-life${path}`),
    ...LOCATION_PATTERNS.map(path => `/reslife${path}`),
    ...LOCATION_PATTERNS // Direct paths
  ];

  const allPaths = [...testPaths, ...locationBasedPaths];

  const batchSize = 5;
  for (let i = 0; i < allPaths.length; i += batchSize) {
    const batch = allPaths.slice(i, i + batchSize);
    
    await Promise.allSettled(batch.map(async (path) => {
      const testUrl = `${baseUrl}${path}`;
      try {
        const response = await axios.head(testUrl, { 
          timeout: 6000, 
          headers: axiosConfig.headers,
          maxRedirects: 3
        });
        
        if (response.status === 200) {
          foundLinks.add(testUrl);
          console.log(`✅ Found directory/location page: ${testUrl}`);
          
          // If this is a location/community page, also discover sub-pages
          if (LOCATION_PATTERNS.some(pattern => path.includes(pattern.replace(/\//g, '')))) {
            await discoverLocationSubPages(testUrl, foundLinks);
          }
        }
      } catch {
        // Path doesn't exist, continue
      }
    }));
    
    // Rate limiting between batches
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// NEW: Discover location-specific sub-pages with staff
async function discoverLocationSubPages(locationUrl: string, foundLinks: Set<string>): Promise<void> {
  console.log(`🏘️ Discovering location sub-pages from: ${locationUrl}`);
  
  try {
    const response = await axios.get(locationUrl, axiosConfig);
    const $ = cheerio.load(response.data);
    
    // Look for links to individual locations/communities
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      const text = $(el).text().toLowerCase();
      const title = $(el).attr("title")?.toLowerCase() || "";
      
      if (!href) return;
      
      // Check if link looks like a specific location/community
      const isLocationLink = LOCATION_KEYWORDS.some(keyword => 
        text.includes(keyword) || title.includes(keyword) || href.toLowerCase().includes(keyword)
      ) || 
      // Common patterns for specific locations
      /\b(north|south|east|west|tower|hall|court|village|plaza|house)\b/i.test(text) ||
      /\b(building|complex|residence|dorm|suite)\b/i.test(text) ||
      // Specific naming patterns
      /\b[A-Z][a-z]+ (hall|house|court|tower|apartments?)\b/i.test(text);
      
      if (isLocationLink) {
        try {
          const fullUrl = href.startsWith('http') ? href : new URL(href, locationUrl).toString();
          const baseHost = new URL(locationUrl).hostname;
          const linkHost = new URL(fullUrl).hostname;
          
          if (linkHost === baseHost && !foundLinks.has(fullUrl)) {
            foundLinks.add(fullUrl);
            console.log(`   🏘️ Found location sub-page: ${text.trim()} → ${fullUrl}`);
          }
        } catch {
          // Invalid URL, skip
        }
      }
    });
    
  } catch (err) {
    console.warn(`⚠️ Failed to discover sub-pages from ${locationUrl}:`, err);
  }
}

function extractFullUrl(url: string): string | null {
  try {
    if (url.includes('duckduckgo.com/l/')) {
      const urlMatch = url.match(/uddg=([^&]+)/);
      if (urlMatch) return decodeURIComponent(urlMatch[1]);
    }
    return url.startsWith('http') ? url : 'https://' + url;
  } catch {
    return null;
  }
}

// Enhanced Contact Information Extraction
function extractContactInfo($section: cheerio.Cheerio<AnyNode>, email: string): { name: string; title?: string; isContactForm: boolean } {
  const text = $section.text();
  const html = $section.html() || "";
  
  const isContactForm = html.includes('<form') || text.toLowerCase().includes('submit') || 
                       text.toLowerCase().includes('contact form') ||
                       html.includes('type="submit"');

  if (isContactForm) return { name: "", isContactForm: true };

  const lines = text.split(/[\n\r]+/).map(line => line.trim()).filter(Boolean);
  let name = "";
  let title = undefined;

  // Enhanced name/title extraction
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(email)) {
      // Look for name in nearby lines with better context
      for (let j = Math.max(0, i - 4); j <= Math.min(lines.length - 1, i + 4); j++) {
        if (j === i) continue;
        
        const candidate = lines[j];
        if (candidate && isValidName(candidate) && !candidate.includes('@') && !candidate.includes('phone')) {
          name = candidate;
          
          // Enhanced title detection
          const searchRange = 2;
          for (let k = Math.max(0, j - searchRange); k <= Math.min(lines.length - 1, j + searchRange); k++) {
            if (k === j) continue;
            const titleCandidate = lines[k];
            if (titleCandidate && isValidTitle(titleCandidate)) {
              title = titleCandidate;
              break;
            }
          }
          break;
        }
      }
      break;
    }
  }

  return { name, title, isContactForm: false };
}

// Enhanced Structured Data Extraction
function extractStructuredData($: cheerio.CheerioAPI, universityName: string, url: string, admins: HousingAdmin[]): void {
  console.log(`🔍 Extracting structured data from: ${url}`);
  
  // Schema.org Person microdata
  $('[itemscope][itemtype*="Person"]').each((_, el) => {
    const $el = $(el);
    const name = $el.find('[itemprop="name"]').text().trim() || 
                 $el.find('[itemprop="givenName"]').text().trim() + ' ' + $el.find('[itemprop="familyName"]').text().trim();
    const email = $el.find('[itemprop="email"]').text().trim() || 
                  $el.find('[itemprop="email"]').attr('href')?.replace('mailto:', '');
    const title = $el.find('[itemprop="jobTitle"]').text().trim();
    const phone = $el.find('[itemprop="telephone"]').text().trim();
    
    if (name && email && isValidName(name)) {
      admins.push({
        university_name: universityName,
        admin_name: name,
        title: title || "Housing Staff",
        email: email,
        phone: phone || undefined,
        department: "Housing",
        scraped_at: new Date().toISOString(),
        source_url: url
      });
      console.log(`✅ Found structured data admin: ${name} (${email})`);
    }
  });

  // Enhanced data attribute extraction
  STRUCTURED_DATA_SELECTORS.forEach(selector => {
    $(selector).each((_, el) => {
      const $el = $(el);
      const emailRaw = $el.attr('data-email') || $el.data('email') || $el.find('[data-email]').attr('data-email');
      const nameRaw = $el.attr('data-name') || $el.data('name') || $el.find('.name, .person-name, h3, h4').first().text().trim();
      const titleRaw = $el.attr('data-title') || $el.data('title') || $el.find('.title, .job-title, .position').first().text().trim();

      const email = typeof emailRaw === 'string' ? emailRaw : (emailRaw ? emailRaw.toString() : '');
      const name = typeof nameRaw === 'string' ? nameRaw : (nameRaw ? nameRaw.toString() : '');
      const title = typeof titleRaw === 'string' ? titleRaw : (titleRaw ? titleRaw.toString() : '');

      if (email && name && isValidName(name)) {
        admins.push({
          university_name: universityName,
          admin_name: name,
          title: title || "Housing Contact",
          email: email,
          department: "Housing",
          scraped_at: new Date().toISOString(),
          source_url: url
        });
        console.log(`✅ Found data attribute admin: ${name} (${email})`);
      }
    });
  });
}

// Enhanced Main Scraping Function
async function scrapeHousingAdmins(universityName: string, url: string, tracker: URLTracker): Promise<HousingAdmin[]> {
  console.log(`🔍 Scraping housing admins from: ${url}`);
  
  // CHECK: Skip if already scraped
  if (tracker.hasBeenScraped(url)) {
    console.log(`⏭️ Skipping already scraped URL: ${url}`);
    return [];
  }
  
  const admins: HousingAdmin[] = [];

  try {
    const res = await axios.get(url, axiosConfig);
    const $ = cheerio.load(res.data);

    // MARK: Mark as scraped early
    tracker.markAsScraped(url);

    // First extract structured data
    extractStructuredData($, universityName, url, admins);

    // Enhanced contact page discovery with tracker
    const contactLinks = await discoverContactPages($, url, tracker);
    console.log(`📞 Found ${contactLinks.length} contact pages to explore`);

    // LIMIT: Reduce from 8 to 5 contact pages
    const urlsToScrape = [url, ...contactLinks.slice(0, 5)];
    
    for (const scrapeUrl of urlsToScrape) {
      // SKIP: If already scraped
      if (scrapeUrl !== url && tracker.hasBeenScraped(scrapeUrl)) {
        console.log(`⏭️ Skipping already scraped contact page: ${scrapeUrl}`);
        continue;
      }
      
      try {
        const pageRes = scrapeUrl === url ? res : await axios.get(scrapeUrl, axiosConfig);
        const $page = cheerio.load(pageRes.data);
        
        // Enhanced staff section detection
        await scrapePageForStaff($page, universityName, scrapeUrl, admins, tracker);
        
        // MARK: Mark contact page as scraped
        if (scrapeUrl !== url) {
          tracker.markAsScraped(scrapeUrl);
        }

        if (scrapeUrl !== url) await new Promise(resolve => setTimeout(resolve, 800));
      } catch (err) {
        console.warn(`⚠️ Failed to scrape ${scrapeUrl}:`, err);
      }
    }

    return admins;
  } catch (err) {
    console.error(`❌ Failed to scrape ${url}:`, err);
    throw new Error(`Failed to scrape housing page: ${url}`);
  }
}

async function discoverContactPages($: cheerio.CheerioAPI, baseUrl: string, tracker: URLTracker): Promise<string[]> {
  const contactLinks: string[] = [];
  const enhancedContactKeywords = [
    ...CONTACT_KEYWORDS,
    'staff directory', 'faculty staff', 'personnel', 'leadership',
    'management', 'administration', 'team members', 'our staff',
    ...LOCATION_KEYWORDS
  ];

  $("a[href]").each((_, el) => {
    if (contactLinks.length >= 8) return false; // LIMIT: Stop at 8 links
    
    const href = $(el).attr("href");
    const text = $(el).text().toLowerCase().trim();
    const title = $(el).attr("title")?.toLowerCase() || "";

    if (!href) return;

    const isContactLink = enhancedContactKeywords.some(keyword => 
      text.includes(keyword) || title.includes(keyword) || href.toLowerCase().includes(keyword)
    );

    const isLocationLink = LOCATION_KEYWORDS.some(keyword => 
      text.includes(keyword) || title.includes(keyword)
    ) || 
    /\b(north|south|east|west|tower|hall|court|village|plaza|house)\b/i.test(text) ||
    /\b(building|complex|residence|dorm|suite)\b/i.test(text) ||
    /\b[A-Z][a-z]+ (hall|house|court|tower|apartments?)\b/i.test(text);

    if (isContactLink || isLocationLink) {
      try {
        const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).toString();
        const baseHost = new URL(baseUrl).hostname;
        const linkHost = new URL(fullUrl).hostname;
        
        // CHECK: Skip if already discovered or scraped
        if (linkHost === baseHost && 
            !tracker.hasBeenScraped(fullUrl) && 
            !contactLinks.includes(fullUrl)) {
          contactLinks.push(fullUrl);
          const linkType = isLocationLink ? "location" : "contact";
          console.log(`   📞 Found ${linkType} link: ${text} → ${fullUrl}`);
        }
      } catch {
        // Invalid URL, skip
      }
    }
  });

  return contactLinks;
}

async function scrapePageForStaff($: cheerio.CheerioAPI, universityName: string, url: string, admins: HousingAdmin[], tracker: URLTracker): Promise<void> {
  // Enhanced staff section detection using research-based selectors
  const staffSections = $([
    ...STAFF_SECTION_SELECTORS,
    "table", "tbody", "tr", // Table-based layouts (30% of sites)
    ".directory", ".contact-list", ".personnel-list",
    "div, section, article, main" // Fallback
  ].join(", ")).filter((_, el) => {
    const $el = $(el);
    const text = $el.text().toLowerCase();
    const className = $el.attr('class')?.toLowerCase() || '';
    const id = $el.attr('id')?.toLowerCase() || '';
    
    const hasHousingKeyword = HOUSING_KEYWORDS.some(kw => text.includes(kw) || className.includes(kw) || id.includes(kw));
    const hasAdminTitle = ADMIN_TITLES.some(title => text.includes(title));
    const hasEmail = text.includes('@');
    const hasStaffIndicator = ['staff', 'team', 'person', 'contact', 'directory'].some(indicator => 
      className.includes(indicator) || id.includes(indicator));
    
    return (hasHousingKeyword || hasAdminTitle || hasEmail || hasStaffIndicator) && text.length > 30;
  });

  console.log(`📋 Found ${staffSections.length} potential staff sections on ${url}`);

  // Enhanced extraction from each section
  staffSections.each((_, section) => {
    const $section = $(section);
    const sectionText = $section.text();
    const emails = extractEmails(sectionText);
    const phones = extractPhones(sectionText);

    // Table-specific extraction for structured layouts
    if ($section.is('table, tbody') || $section.find('table').length > 0) {
      extractFromTableStructure($section, universityName, url, admins, $);
    }

    emails.forEach(email => {
      if (tracker.hasEmail(email)) {
      console.log(`⏭️ Skipping duplicate email: ${email}`);
      return;
      }
      const { name, title, isContactForm } = extractContactInfo($section, email);

        
      if (email && (name || isContactForm)) {
        // Enhanced: Extract location context from URL for better categorization
        tracker.addEmail(email);
        const locationContext = extractLocationContext(url);
        const enhancedTitle = locationContext && title ? 
          `${title} - ${locationContext}` : 
          (title || (isContactForm ? "Contact via form" : "Housing Staff"));

        const admin: HousingAdmin = {
          university_name: universityName,
          admin_name: name || "Contact Form",
          title: enhancedTitle,
          email: isContactForm ? "contact-form" : email,
          phone: phones[0],
          department: locationContext || "Housing",
          scraped_at: new Date().toISOString(),
          source_url: url
        };

        admins.push(admin);
        console.log(`✅ Found admin: ${admin.admin_name} (${admin.email}) - ${locationContext || 'General'}`);
      }
    });
  });

  // NEW: Deep scan for location-specific staff information
  await scanForLocationStaff($, universityName, url, admins);
}

// NEW: Extract location context from URL for better staff categorization
function extractLocationContext(url: string): string | null {
  try {
    const urlPath = new URL(url).pathname.toLowerCase();
    
    // Common location patterns in URLs
    const locationPatterns = [
      { pattern: /\/off-campus/, name: "Off-Campus Housing" },
      { pattern: /\/graduate/, name: "Graduate Housing" },
      { pattern: /\/undergraduate/, name: "Undergraduate Housing" },
      { pattern: /\/family/, name: "Family Housing" },
      { pattern: /\/north-campus/, name: "North Campus" },
      { pattern: /\/south-campus/, name: "South Campus" },
      { pattern: /\/east-campus/, name: "East Campus" },
      { pattern: /\/west-campus/, name: "West Campus" },
      { pattern: /\/apartments/, name: "University Apartments" },
      { pattern: /\/residence-halls?/, name: "Residence Halls" },
      { pattern: /\/communities/, name: "Residential Communities" },
      { pattern: /\/suites/, name: "Suites" },
      { pattern: /\/towers?/, name: "Residence Towers" }
    ];
    
    for (const { pattern, name } of locationPatterns) {
      if (pattern.test(urlPath)) {
        return name;
      }
    }
    
    // Extract specific building/location names from URL
    const buildingMatch = urlPath.match(/\/([\w-]+)-(hall|house|court|tower|apartments?|complex)/);
    if (buildingMatch) {
      const buildingName = buildingMatch[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const buildingType = buildingMatch[2].replace(/\b\w/g, l => l.toUpperCase());
      return `${buildingName} ${buildingType}`;
    }
    
    return null;
  } catch {
    return null;
  }
}

// NEW: Deep scan for location-specific staff that might be embedded in content
async function scanForLocationStaff($: cheerio.CheerioAPI, universityName: string, url: string, admins: HousingAdmin[]): Promise<void> {
  // Look for location-specific staff sections
  const locationStaffSelectors = [
    '.location-staff', '.building-staff', '.community-staff',
    '.hall-staff', '.residence-staff', '.apartment-staff',
    '[class*="staff"][class*="location"]',
    '[class*="staff"][class*="building"]',
    '[class*="staff"][class*="community"]'
  ];

  locationStaffSelectors.forEach(selector => {
    $(selector).each((_, el) => {
      const $el = $(el);
      const text = $el.text();
      const emails = extractEmails(text);
      
      emails.forEach(email => {
        const { name, title } = extractContactInfo($el, email);
        if (name && email) {
          const locationContext = extractLocationContext(url);
          
          admins.push({
            university_name: universityName,
            admin_name: name,
            title: title || "Location Staff",
            email: email,
            department: locationContext || "Housing",
            scraped_at: new Date().toISOString(),
            source_url: url
          });
          
          console.log(`✅ Found location staff: ${name} (${email}) - ${locationContext || 'Location'}`);
        }
      });
    });
  });

  // Enhanced: Look for staff information in common content patterns
  const contentPatterns = [
    'building manager:', 'hall director:', 'community advisor:',
    'residence coordinator:', 'area coordinator:', 'staff contact:',
    'housing coordinator:', 'resident advisor:', 'building coordinator:'
  ];

  contentPatterns.forEach(pattern => {
    const regex = new RegExp(pattern + '\\s*([^\\n@]*@[^\\s\\n]+)', 'gi');
    const pageText = $.text();
    let match;
    
    while ((match = regex.exec(pageText)) !== null) {
      const email = match[1].trim();
      if (email && extractEmails(email).length > 0) {
        const locationContext = extractLocationContext(url);
        const roleTitle = pattern.replace(':', '').replace(/\b\w/g, l => l.toUpperCase());
        
        // Try to extract name from surrounding context
        const contextStart = Math.max(0, match.index - 100);
        const contextEnd = Math.min(pageText.length, match.index + match[0].length + 100);
        const context = pageText.slice(contextStart, contextEnd);
        
        const nameMatch = context.match(/([A-Z][a-z]+ [A-Z][a-z]+)/);
        const name = nameMatch ? nameMatch[1] : "Staff Member";
        
        admins.push({
          university_name: universityName,
          admin_name: name,
          title: `${roleTitle} - ${locationContext || 'Housing'}`,
          email: email,
          department: locationContext || "Housing",
          scraped_at: new Date().toISOString(),
          source_url: url
        });
        
        console.log(`✅ Found pattern staff: ${name} (${email}) - ${roleTitle}`);
      }
    }
  });
}

// Fixed Table Structure Extraction
function extractFromTableStructure($table: cheerio.Cheerio<AnyNode>, universityName: string, url: string, admins: HousingAdmin[], cheerioInstance: cheerio.CheerioAPI): void {
  $table.find('tr').each((_, row) => {
    const $row = cheerioInstance(row);
    const cells = $row.find('td, th').map((_, cell: Element) => 
      cheerioInstance(cell).text().trim()
      ).get();
    
    if (cells.length >= 2) {
      const rowText = cells.join(' ');
      const emails = extractEmails(rowText);
      const phones = extractPhones(rowText);
      
      emails.forEach(email => {
        let name = "";
        let title = "";
        
        // Find the cell containing the email
        cells.forEach((cellText: string, index: number) => {
          if (cellText.includes(email)) {
            // Name is usually in the first column or previous cell
            if (index > 0 && isValidName(cells[index - 1])) {
              name = cells[index - 1];
            } else if (index === 0 && cells.length > 1 && isValidName(cells[1])) {
              name = cells[1];
            }
            
            // Title might be in adjacent cells
            cells.forEach((cell: string) => {
              if (cell !== name && cell !== email && isValidTitle(cell)) {
                title = cell;
              }
            });
          }
        });
        
        // If no name found in adjacent cells, look for any valid name in the row
        if (!name) {
          const validNames = cells.filter((cell: string) => isValidName(cell) && !cell.includes(email));
          if (validNames.length > 0) name = validNames[0];
        }
        
        if (name) {
          admins.push({
            university_name: universityName,
            admin_name: name,
            title: title || "Housing Staff",
            email: email,
            phone: phones[0],
            department: "Housing",
            scraped_at: new Date().toISOString(),
            source_url: url
          });
          console.log(`✅ Found table admin: ${name} (${email})`);
        }
      });
    }
  });
}

// Enhanced Scoring and Filtering
function scoreAndFilterAdministrators(admins: HousingAdmin[]): HousingAdmin[] {
  console.log(`📊 Scoring ${admins.length} administrators`);
  
  const scoredAdmins = admins.map(admin => {
    let score = 0;
    const email = admin.email.toLowerCase();
    const name = admin.admin_name.toLowerCase();
    const title = admin.title.toLowerCase();
    
    // Email domain scoring
    if (email.includes('.edu')) score += 15;
    if (email.includes('housing') || email.includes('residential') || email.includes('hdh')) score += 25;
    if (email.includes('residence') || email.includes('dorm')) score += 20;
    
    // Title relevance scoring
    if (['director', 'coordinator', 'manager', 'administrator'].some(kw => title.includes(kw))) score += 25;
    if (['assistant director', 'associate director', 'deputy'].some(kw => title.includes(kw))) score += 22;
    if (['assistant', 'associate', 'specialist', 'advisor'].some(kw => title.includes(kw))) score += 15;
    if (['housing', 'residential', 'residence'].some(kw => title.includes(kw))) score += 30;
    if (['dean', 'vice'].some(kw => title.includes(kw))) score += 20;
    
    // Name quality scoring
    if (name.includes(' ') && !name.includes('contact') && !name.includes('form')) score += 20;
    if (name.split(' ').length >= 2 && name.split(' ').length <= 4) score += 10; // Realistic name length
    
    // Department-specific boosts
    if (title.includes('community') || title.includes('program')) score += 10;
    if (title.includes('student') && (title.includes('life') || title.includes('services'))) score += 15;
    
    // Penalties for low-quality entries
    if (name.length < 3 || name.length > 60) score -= 25;
    if (/^\d+$/.test(name)) score -= 100;
    if (['png', 'jpg', 'noreply', 'signup', 'unsubscribe'].some(bad => email.includes(bad))) score -= 100;
    if (name.includes('copyright') || name.includes('equal housing')) score -= 100;
    
    // Contact form handling
    if (email === 'contact-form') score = 8; // Slightly higher base score
    
    // High-value email patterns
    if (['staff', 'admin', 'office'].some(kw => email.includes(kw))) score += 15;
    
    return { ...admin, relevance_score: score };
  });
  
  // More lenient filtering to capture edge cases
  const filtered = scoredAdmins.filter(admin => admin.relevance_score! > -20)
    .sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
  
  console.log(`✅ Filtered to ${filtered.length} relevant administrators`);
  filtered.slice(0, 10).forEach(admin => {
    console.log(`   📋 ${admin.admin_name} (${admin.email}) - Score: ${admin.relevance_score}`);
  });
  
  return filtered;
}

function removeDuplicateAdmins(admins: HousingAdmin[]): HousingAdmin[] {
  const seen = new Set<string>();
  const filtered: HousingAdmin[] = [];
  let contactFormCount = 0;
  
  for (const admin of admins) {
    const emailKey = admin.email.toLowerCase();
    const nameKey = normalizeUniversityName(admin.admin_name);
    const combinedKey = `${emailKey}-${nameKey}`;
    
    // Enhanced contact form handling
    if (admin.email === 'contact-form') {
      const contactFormKey = `contact-form-${admin.source_url}`;
      if (seen.has(contactFormKey) || contactFormCount >= 3) continue; // Allow up to 3 contact forms
      seen.add(contactFormKey);
      contactFormCount++;
    }
    
    // Check for duplicate emails or combined keys
    if (seen.has(emailKey) || seen.has(combinedKey)) {
      console.log(`⏭️ Removing duplicate: ${admin.admin_name} (${admin.email})`);
      continue;
    }
    
    seen.add(emailKey);
    seen.add(combinedKey);
    filtered.push(admin);
  }
  
  console.log(`📊 Removed ${admins.length - filtered.length} duplicates, kept ${filtered.length}`);
  return filtered;
}

async function checkForDuplicateAdministrators(universityId: string, admins: HousingAdmin[]): Promise<HousingAdmin[]> {
  const { data: existingAdmins, error } = await supabase
    .from("administrators")
    .select("email, name")
    .eq("university_id", universityId);

  if (error) {
    console.warn(`⚠️ Could not check existing administrators: ${error.message}`);
    return admins;
  }

  const existingEmails = new Set(existingAdmins?.map(admin => admin.email.toLowerCase()) || []);
  const existingNames = new Set(existingAdmins?.map(admin => normalizeUniversityName(admin.name)) || []);

  const newAdmins = admins.filter(admin => {
    const emailExists = existingEmails.has(admin.email.toLowerCase());
    const nameExists = existingNames.has(normalizeUniversityName(admin.admin_name));
    
    if (emailExists || nameExists) {
      console.log(`⏭️ Skipping existing: ${admin.admin_name} (${admin.email})`);
      return false;
    }
    
    return true;
  });

  console.log(`📊 Filtered ${admins.length - newAdmins.length} existing, ${newAdmins.length} new`);
  return newAdmins;
}

async function findExistingUniversity(universityName: string): Promise<University | null> {
  const nameVariations = generateUniversityVariations(universityName);
  
  // NEW: Also add database-normalized versions
  const normalizedVariations = [
    ...nameVariations,
    normalizeUniversityNameForDatabase(universityName),
    ...nameVariations.map(v => normalizeUniversityNameForDatabase(v))
  ];
  
  const uniqueVariations = Array.from(new Set(normalizedVariations));
  console.log(`🔍 Checking for existing university with variations:`, uniqueVariations);

  for (const variation of uniqueVariations) {
    const { data: existing, error } = await supabase
      .from("universities")
      .select("*")
      .eq("name", variation) // Use exact match since both are normalized
      .limit(1);

    if (!error && existing?.length > 0) {
      console.log(`✅ Found normalized match: ${existing[0].name}`);
      return existing[0];
    }
  }
  
  // Fallback: try partial match
  for (const variation of uniqueVariations) {
    const { data: existing, error } = await supabase
      .from("universities")
      .select("*")
      .ilike("name", `%${variation}%`)
      .limit(1);

    if (!error && existing?.length > 0) {
      console.log(`✅ Found partial match: ${existing[0].name}`);
      return existing[0];
    }
  }
  
  return null;
}

async function createUniversity(universityName: string, domain: string | null, housingPages: string[] = []): Promise<University> {
  console.log(`➕ Creating new university: ${universityName}`);
  
  // NEW: Normalize the university name before saving
  const normalizedName = normalizeUniversityNameForDatabase(universityName);
  console.log(`📝 Normalized name: "${universityName}" → "${normalizedName}"`);
  
  const newUniversity = {
    name: normalizedName, // Use normalized name
    website: domain ? `https://${domain}` : null,
    housing_pages_discovered: housingPages
  };

  const { data: created, error } = await supabase
    .from("universities")
    .insert(newUniversity)
    .select()
    .single();

  if (error) {
    if (error.message?.includes('housing_pages_discovered')) {
      console.log('📝 housing_pages_discovered column not found, creating without it');
      const { data: fallbackCreated, error: fallbackError } = await supabase
        .from("universities")
        .insert({ name: normalizedName, website: domain ? `https://${domain}` : null })
        .select()
        .single();
        
      if (fallbackError) throw new Error(`Failed to create university: ${fallbackError.message}`);
      return fallbackCreated;
    }
    throw new Error(`Failed to create university: ${error.message}`);
  }

  console.log(`✅ Created university: ${created.name} (ID: ${created.id})`);
  return created;
}

// Main API Handler with Enhanced Error Handling
export async function POST(req: Request) {

  const { universityName } = await req.json();
  // Try LLM first
  try {
  const llmRes = await llmScrape(new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify({ universityName }),
    headers: { "Content-Type": "application/json" },
  }));

  const llmData = await llmRes.json();

  if (llmData.success && llmData.inserted > 0) {
    return NextResponse.json({ ...llmData, source: "llm" });
  }
} catch (err) {
  console.warn("⚠️ LLM failed, falling back:", err);
}
  
  if (!universityName) {
    return NextResponse.json({ 
      success: false,
      message: "Missing universityName parameter" 
    }, { status: 400 });
  }

  console.log(`🎯 Starting enhanced scrape for: ${universityName}`);

  const tracker = new URLTracker();

  try {
    // Check if university exists
    const existingUniversity = await findExistingUniversity(universityName);
    
    if (existingUniversity) {
      const { data: existingAdmins } = await supabase
        .from("administrators")
        .select("*")
        .eq("university_id", existingUniversity.id);

      if ((existingAdmins ?? []).length > 0) {
        return NextResponse.json({ 
          success: true,
          university: existingUniversity,
          admins: existingAdmins ?? [],
          message: `University already exists with ${(existingAdmins ?? []).length} administrators`,
          existing: true,
          suggestion: "If you want to rescrape, delete the existing university first."
        });
      }
    }

    // Enhanced housing page discovery
    const housingPages = await searchHousingPages(universityName);
    
    if (housingPages.length === 0) {
      return NextResponse.json({ 
        success: false,
        message: `No housing pages found for ${universityName}`,
        suggestion: "The university may not have easily discoverable housing information online, or it may use a different naming convention."
      }, { status: 404 });
    }

    console.log(`📄 Found ${housingPages.length} housing pages to scrape:`, housingPages);

    const allAdmins: HousingAdmin[] = [];
    const scrapingResults: { url: string; success: boolean; count: number; error?: string }[] = [];
    const startTime = Date.now();
    let timedOut = false;

    // Process each housing page
    for (const url of housingPages) {
      // Check timeout before each page
      if (Date.now() - startTime > SCRAPING_TIMEOUT_MS) {
        console.log(`⏰ Scraping timeout reached after ${Math.round((Date.now() - startTime) / 1000)}s`);
        timedOut = true;
        break;
      }

      try {
        // Create a timeout promise for this specific page
        const pageTimeout = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Page timeout')), BATCH_TIMEOUT_MS);
        });

        const scrapingPromise = scrapeHousingAdmins(universityName, url, tracker);
        const admins = await Promise.race([scrapingPromise, pageTimeout]);
        
        allAdmins.push(...admins);
        scrapingResults.push({ url, success: true, count: admins.length });
        console.log(`✅ Scraped ${admins.length} admins from ${url}`);
        
        // Enhanced: If this is a main housing page, also try to discover community/location pages
        if (url.includes('/housing') || url.includes('/residential') || url.includes('/reslife')) {
          const additionalPages = await discoverCommunityPages(url, tracker);
          console.log(`🔍 Found ${additionalPages.length} additional community pages from ${url}`);
          
          // Scrape additional community pages with timeout checks
          for (const additionalUrl of additionalPages.slice(0, 3)) {
            if (Date.now() - startTime > SCRAPING_TIMEOUT_MS) {
              console.log(`⏰ Timeout reached while processing additional pages`);
              timedOut = true;
              break;
            }

            try {
              const additionalPromise = scrapeHousingAdmins(universityName, additionalUrl, tracker);
              const additionalAdmins = await Promise.race([additionalPromise, pageTimeout]);
              allAdmins.push(...additionalAdmins);
              scrapingResults.push({ url: additionalUrl, success: true, count: additionalAdmins.length });
              console.log(`✅ Scraped ${additionalAdmins.length} additional admins from ${additionalUrl}`);
            } catch (err: unknown) {
              const errorMsg = err instanceof Error && err.message === 'Page timeout' 
                ? 'Page timeout (2min)' 
                : (err instanceof Error ? err.message : 'Unknown error');
              scrapingResults.push({ url: additionalUrl, success: false, count: 0, error: errorMsg });
              console.warn(`⚠️ Failed to scrape additional page ${additionalUrl}: ${errorMsg}`);
            }
          }
          
          if (timedOut) break;
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error && err.message === 'Page timeout' 
          ? 'Page timeout (2min)' 
          : (err instanceof Error ? err.message : 'Unknown error');
        scrapingResults.push({ url, success: false, count: 0, error: errorMsg });
        console.warn(`⚠️ Failed to scrape ${url}: ${errorMsg}`);
      }
    }

    console.log(`⏰ Scraping completed in ${Math.round((Date.now() - startTime) / 1000)}s${timedOut ? ' (TIMED OUT)' : ''}`);

    // Rest of your existing code for processing and saving administrators...
// NEW: Discover community/location pages from main housing pages
async function discoverCommunityPages(mainUrl: string, tracker: URLTracker): Promise<string[]> {
  console.log(`🏘️ Discovering community pages from: ${mainUrl}`);

  if (tracker.hasBeenScraped(mainUrl)) {
    console.log(`⏭️ Skipping community discovery for already scraped URL: ${mainUrl}`);
    return [];
  }

  const communityPages: string[] = [];
  
  try {
    const response = await axios.get(mainUrl, axiosConfig);
    const $ = cheerio.load(response.data);
    
    // Look for links that indicate specific communities/locations
    $("a[href]").each((_, el) => {
      if (communityPages.length >= 10) return false;

      const href = $(el).attr("href");
      const text = $(el).text().toLowerCase().trim();
      const title = $(el).attr("title")?.toLowerCase() || "";
      
      if (!href) return;
      
      // Enhanced patterns for community/location detection
      const isCommunityLink = 
        // Location keywords
        LOCATION_KEYWORDS.some(keyword => text.includes(keyword) || title.includes(keyword)) ||
        // Building/location patterns
        /\b(north|south|east|west|upper|lower|new|old)\s+(campus|village|complex|area)/i.test(text) ||
        // Specific building types
        /\b(tower|hall|court|house|plaza|village|commons|square|center)\b/i.test(text) ||
        // Academic year housing
        /\b(freshman|sophomore|junior|senior|graduate|family)\s+(housing|apartments?|residence)/i.test(text) ||
        // Numbered buildings or specific names
        /\b[A-Z][a-z]+\s+(hall|house|court|tower|apartments?|complex|village)\b/i.test(text) ||
        // URL patterns
        /\/(community|location|building|hall|residence|apartment)s?\//i.test(href) ||
        /\/(north|south|east|west)-/i.test(href);
      
      if (isCommunityLink) {
        try {
          const fullUrl = href.startsWith('http') ? href : new URL(href, mainUrl).toString();
          const baseHost = new URL(mainUrl).hostname;
          const linkHost = new URL(fullUrl).hostname;
          
          if (linkHost === baseHost && 
              !tracker.hasBeenScraped(fullUrl) && 
              !communityPages.includes(fullUrl)) {
            communityPages.push(fullUrl);
            console.log(`   🏘️ Found community page: ${text.trim()} → ${fullUrl}`);
          }
        } catch {
          // Invalid URL, skip
        }
      }
    });
    
    // Also look for navigation menus or sections dedicated to communities
    const communityNavigation = $([
      '.communities-nav', '.locations-nav', '.housing-nav',
      '[class*="communities"]', '[class*="locations"]', '[id*="communities"]'
    ].join(", "));
    
    communityNavigation.find("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      const text = $(el).text().toLowerCase().trim();
      
      if (href && text.length > 2) {
        try {
          const fullUrl = href.startsWith('http') ? href : new URL(href, mainUrl).toString();
          const baseHost = new URL(mainUrl).hostname;
          const linkHost = new URL(fullUrl).hostname;
          
          if (linkHost === baseHost && !communityPages.includes(fullUrl)) {
            communityPages.push(fullUrl);
            console.log(`   🏘️ Found nav community page: ${text.trim()} → ${fullUrl}`);
          }
        } catch {
          // Invalid URL, skip
        }
      }
    });
    
  } catch (err) {
    console.warn(`⚠️ Failed to discover community pages from ${mainUrl}:`, err);
  }
  
  return communityPages.slice(0, 10); // Limit to prevent too many requests
}

    // Process and save administrators
    const domain = await guessUniversityDomain(universityName);
    const university = existingUniversity || await createUniversity(universityName, domain, housingPages);

    if (allAdmins.length === 0) {
      return NextResponse.json({ 
        success: true,
        university,
        admins: [],
        message: `No administrators found from ${housingPages.length} housing pages`,
        housing_pages_found: housingPages,
        scraping_results: scrapingResults,
        no_admins_found: true,
        suggestion: "The housing pages were found but may not contain easily extractable contact information, or they may require JavaScript rendering."
      });
    }

    const scoredAdmins = scoreAndFilterAdministrators(allAdmins);
    const uniqueAdmins = removeDuplicateAdmins(scoredAdmins);
    const newAdmins = await checkForDuplicateAdministrators(university.id, uniqueAdmins);

    if (newAdmins.length > 0) {
      const { error } = await supabase
        .from("administrators")
        .insert(newAdmins.map(admin => ({
          name: admin.admin_name,
          role: admin.title,
          email: admin.email,
          phone: admin.phone ?? null,
          source_url: admin.source_url ?? null,
          status: "not_contacted",
          university_id: university.id
        })));

      if (error) throw new Error(`Database error: ${error.message}`);
      console.log(`✅ Successfully inserted ${newAdmins.length} administrators`);
    }

    return NextResponse.json({
      success: true,
      timed_out: timedOut,
      scraping_duration_seconds: Math.round((Date.now() - startTime) / 1000),
      university,
      admins: newAdmins,
      message: `${timedOut ? 'Partially scraped (timed out after 10min): ' : 'Successfully scraped '}${newAdmins.length} administrators from ${housingPages.length} housing pages`,
      housing_pages_found: housingPages,
      scraping_results: scrapingResults,
      total_found: allAdmins.length,
      filtered_relevant: scoredAdmins.length,
      new_inserted: newAdmins.length,
      skipped_duplicates: uniqueAdmins.length - newAdmins.length,
      scraping_details: {
        pages_discovered: housingPages.length,
        pages_successfully_scraped: scrapingResults.filter(r => r.success).length,
        total_contacts_found: allAdmins.length,
        relevant_contacts: scoredAdmins.length,
        unique_contacts: uniqueAdmins.length,
        final_inserted: newAdmins.length
      }
    });

  } catch (err: unknown) {
    console.error("❌ Enhanced scraping failed:", err);
    
    let errorMessage = "Enhanced scraping failed";
    let statusCode = 500;
    
    const errMsg = err instanceof Error ? err.message : String(err);
    
    if (errMsg.includes("Could not find")) {
      errorMessage = `Could not find the official website for "${universityName}". Please verify the university name.`;
      statusCode = 404;
    } else if (errMsg.includes("timeout")) {
      errorMessage = `Request timeout while accessing university website. The site may be slow or temporarily unavailable.`;
      statusCode = 503;
    } else if (errMsg.includes("Database error")) {
      errorMessage = `Database operation failed: ${errMsg}`;
      statusCode = 500;
    } else {
      errorMessage = `Unexpected error: ${errMsg}`;
    }

    return NextResponse.json({ 
      success: false,
      message: errorMessage,
      error: errMsg,
      university_name: universityName,
      timestamp: new Date().toISOString()
    }, { status: statusCode });
  }
}