// ─────────────────────────────────────────────────────────────────────────────
// Supply Chain Disaster — pSEO Trade Lane Database
// Generates 1,040+ unique trade lane pages
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. RISK ZONES ─────────────────────────────────────────────────────────────
export const RISK_ZONES = {
  'red-sea': {
    name: 'Red Sea / Suez Canal',
    multiplier: 1.45,
    timeAddDays: 0,
    description: 'Active Houthi threat in Red Sea corridor. Mandatory naval escort or Cape rerouting.',
    severity: 'critical',
    color: '#ef4444',
  },
  'cape-good-hope': {
    name: 'Cape of Good Hope Bypass',
    multiplier: 1.28,
    timeAddDays: 10,
    description: 'Rerouting via Cape adds ~10 days and 12% fuel surcharge versus Suez Canal route.',
    severity: 'high',
    color: '#f97316',
  },
  'south-china-sea': {
    name: 'South China Sea',
    multiplier: 1.12,
    timeAddDays: 0,
    description: 'Territorial tension and typhoon season (Jun–Nov) elevate cargo insurance premiums.',
    severity: 'medium',
    color: '#f59e0b',
  },
  'malacca': {
    name: 'Strait of Malacca',
    multiplier: 1.10,
    timeAddDays: 0,
    description: 'High vessel traffic and piracy risk. Maritime insurance loading: +0.035%.',
    severity: 'medium',
    color: '#f59e0b',
  },
  'yellow-sea': {
    name: 'Yellow Sea',
    multiplier: 1.05,
    timeAddDays: 0,
    description: 'Low-level geopolitical tension; minimal impact on most commercial routes.',
    severity: 'low',
    color: '#eab308',
  },
  'normal': {
    name: 'Standard Route',
    multiplier: 1.0,
    timeAddDays: 0,
    description: 'No active conflict or elevated piracy. Standard P&I insurance applicable.',
    severity: 'normal',
    color: '#22c55e',
  },
};

// ── 2. CBAM CARBON BORDER ADJUSTMENT MECHANISM ────────────────────────────────
// EU CBAM fully operative from Jan 2026. Carbon price ~€55/tonne CO2 (2026 est.)
export const CARBON_PRICE_EUR = 55; // EUR per tonne CO2e

export const CBAM_RATES = {
  steel: { co2PerTonne: 1.85, sectorName: 'Iron & Steel', active: true },
  aluminium: { co2PerTonne: 4.50, sectorName: 'Aluminium', active: true },
  cement: { co2PerTonne: 0.90, sectorName: 'Cement', active: true },
  fertilizers: { co2PerTonne: 2.30, sectorName: 'Fertilizers', active: true },
  hydrogen: { co2PerTonne: 0.00, sectorName: 'Hydrogen', active: true },
  chemicals: { co2PerTonne: 0.60, sectorName: 'Chemicals (partial)', active: false },
  electronics: { co2PerTonne: 0.20, sectorName: 'Electronics', active: false },
  textiles: { co2PerTonne: 0.15, sectorName: 'Textiles & Apparel', active: false },
  automotive: { co2PerTonne: 0.40, sectorName: 'Automotive Parts', active: false },
  food: { co2PerTonne: 0.30, sectorName: 'Food & Agriculture', active: false },
  machinery: { co2PerTonne: 0.25, sectorName: 'Machinery & Equipment', active: false },
};

// ── 3. EU IMPORT DUTY RATES (MFN rates, 2026) ─────────────────────────────────
export const EU_DUTY_RATES = {
  electronics: 0.00,      // Most electronics: 0% under ITA
  textiles: 0.12,         // Average 12%
  steel: 0.00,            // 0% MFN + possible AD/CVD
  aluminium: 0.06,        // 6%
  cement: 0.00,           // 0%
  fertilizers: 0.032,     // 3.2%
  hydrogen: 0.00,         // 0%
  chemicals: 0.055,       // 5.5% average
  automotive: 0.065,      // 6.5%
  food: 0.085,            // 8.5% average
  machinery: 0.025,       // 2.5% average
};

export const PRODUCT_CATEGORIES = [
  { id: 'electronics', name: 'Electronics & Tech', unitsPerTEU: 2000, cbamApplies: false },
  { id: 'textiles', name: 'Textiles & Apparel', unitsPerTEU: 3000, cbamApplies: false },
  { id: 'steel', name: 'Steel Products', unitsPerTEU: 18000, cbamApplies: true },
  { id: 'aluminium', name: 'Aluminium Components', unitsPerTEU: 5000, cbamApplies: true },
  { id: 'chemicals', name: 'Industrial Chemicals', unitsPerTEU: 4000, cbamApplies: false },
  { id: 'automotive', name: 'Automotive Parts', unitsPerTEU: 1500, cbamApplies: false },
  { id: 'food', name: 'Processed Food', unitsPerTEU: 8000, cbamApplies: false },
  { id: 'machinery', name: 'Machinery & Equipment', unitsPerTEU: 800, cbamApplies: false },
];

// ── 4. ORIGINS (36 total) ─────────────────────────────────────────────────────
export const ORIGINS = [
  // East Asia — China (8)
  { id: 'shanghai', name: 'Shanghai', country: 'China', countryCode: 'CN', region: 'East Asia', port: 'Port of Shanghai', riskZone: 'south-china-sea', nearshore: false, railEnabled: true, baseTransitSea: { north: 32, south: 28, med: 26, baltic: 35, blacksea: 30 }, baseFreightSea: { north: 2100, south: 1850, med: 1650, baltic: 2300, blacksea: 2000 } },
  { id: 'shenzhen', name: 'Shenzhen', country: 'China', countryCode: 'CN', region: 'East Asia', port: 'Yantian International', riskZone: 'south-china-sea', nearshore: false, railEnabled: true, baseTransitSea: { north: 32, south: 28, med: 26, baltic: 35, blacksea: 30 }, baseFreightSea: { north: 2050, south: 1800, med: 1600, baltic: 2250, blacksea: 1950 } },
  { id: 'guangzhou', name: 'Guangzhou', country: 'China', countryCode: 'CN', region: 'East Asia', port: 'Nansha Port', riskZone: 'south-china-sea', nearshore: false, railEnabled: true, baseTransitSea: { north: 33, south: 29, med: 27, baltic: 36, blacksea: 31 }, baseFreightSea: { north: 2000, south: 1750, med: 1600, baltic: 2200, blacksea: 1900 } },
  { id: 'tianjin', name: 'Tianjin', country: 'China', countryCode: 'CN', region: 'East Asia', port: 'Tianjin Port', riskZone: 'yellow-sea', nearshore: false, railEnabled: true, baseTransitSea: { north: 34, south: 30, med: 28, baltic: 37, blacksea: 32 }, baseFreightSea: { north: 2200, south: 1950, med: 1800, baltic: 2400, blacksea: 2100 } },
  { id: 'qingdao', name: 'Qingdao', country: 'China', countryCode: 'CN', region: 'East Asia', port: 'Qingdao Port', riskZone: 'yellow-sea', nearshore: false, railEnabled: true, baseTransitSea: { north: 33, south: 29, med: 27, baltic: 36, blacksea: 31 }, baseFreightSea: { north: 2150, south: 1900, med: 1750, baltic: 2350, blacksea: 2050 } },
  { id: 'ningbo', name: 'Ningbo', country: 'China', countryCode: 'CN', region: 'East Asia', port: 'Ningbo-Zhoushan Port', riskZone: 'south-china-sea', nearshore: false, railEnabled: true, baseTransitSea: { north: 32, south: 28, med: 26, baltic: 35, blacksea: 30 }, baseFreightSea: { north: 2100, south: 1850, med: 1650, baltic: 2300, blacksea: 2000 } },
  { id: 'hong-kong', name: 'Hong Kong', country: 'China SAR', countryCode: 'HK', region: 'East Asia', port: 'Kwai Tsing Terminal', riskZone: 'south-china-sea', nearshore: false, railEnabled: false, baseTransitSea: { north: 31, south: 27, med: 25, baltic: 34, blacksea: 29 }, baseFreightSea: { north: 2050, south: 1800, med: 1600, baltic: 2250, blacksea: 1950 } },
  { id: 'chongqing', name: 'Chongqing', country: 'China', countryCode: 'CN', region: 'East Asia', port: 'Chongqing Rail Hub', riskZone: 'normal', nearshore: false, railEnabled: true, baseTransitSea: { north: 38, south: 34, med: 32, baltic: 41, blacksea: 36 }, baseFreightSea: { north: 2400, south: 2150, med: 1950, baltic: 2600, blacksea: 2300 } },

  // East Asia — Other (4)
  { id: 'busan', name: 'Busan', country: 'South Korea', countryCode: 'KR', region: 'East Asia', port: 'Busan New Port', riskZone: 'normal', nearshore: false, railEnabled: false, baseTransitSea: { north: 28, south: 24, med: 22, baltic: 31, blacksea: 26 }, baseFreightSea: { north: 1900, south: 1650, med: 1500, baltic: 2100, blacksea: 1800 } },
  { id: 'tokyo', name: 'Tokyo', country: 'Japan', countryCode: 'JP', region: 'East Asia', port: 'Tokyo International Port', riskZone: 'normal', nearshore: false, railEnabled: false, baseTransitSea: { north: 34, south: 30, med: 28, baltic: 37, blacksea: 32 }, baseFreightSea: { north: 2250, south: 2000, med: 1850, baltic: 2450, blacksea: 2150 } },
  { id: 'osaka', name: 'Osaka', country: 'Japan', countryCode: 'JP', region: 'East Asia', port: 'Port of Osaka', riskZone: 'normal', nearshore: false, railEnabled: false, baseTransitSea: { north: 33, south: 29, med: 27, baltic: 36, blacksea: 31 }, baseFreightSea: { north: 2200, south: 1950, med: 1800, baltic: 2400, blacksea: 2100 } },
  { id: 'taipei', name: 'Taipei', country: 'Taiwan', countryCode: 'TW', region: 'East Asia', port: 'Port of Kaohsiung', riskZone: 'south-china-sea', nearshore: false, railEnabled: false, baseTransitSea: { north: 31, south: 27, med: 25, baltic: 34, blacksea: 29 }, baseFreightSea: { north: 2000, south: 1750, med: 1600, baltic: 2200, blacksea: 1900 } },

  // Southeast Asia (6)
  { id: 'ho-chi-minh', name: 'Ho Chi Minh City', country: 'Vietnam', countryCode: 'VN', region: 'Southeast Asia', port: 'Cat Lai Terminal', riskZone: 'south-china-sea', nearshore: false, railEnabled: false, baseTransitSea: { north: 27, south: 23, med: 21, baltic: 30, blacksea: 25 }, baseFreightSea: { north: 1800, south: 1550, med: 1400, baltic: 2000, blacksea: 1700 } },
  { id: 'bangkok', name: 'Bangkok', country: 'Thailand', countryCode: 'TH', region: 'Southeast Asia', port: 'Laem Chabang Port', riskZone: 'malacca', nearshore: false, railEnabled: false, baseTransitSea: { north: 26, south: 22, med: 20, baltic: 29, blacksea: 24 }, baseFreightSea: { north: 1750, south: 1500, med: 1350, baltic: 1950, blacksea: 1650 } },
  { id: 'singapore', name: 'Singapore', country: 'Singapore', countryCode: 'SG', region: 'Southeast Asia', port: 'Port of Singapore (PSA)', riskZone: 'malacca', nearshore: false, railEnabled: false, baseTransitSea: { north: 24, south: 20, med: 18, baltic: 27, blacksea: 22 }, baseFreightSea: { north: 1600, south: 1350, med: 1200, baltic: 1800, blacksea: 1500 } },
  { id: 'jakarta', name: 'Jakarta', country: 'Indonesia', countryCode: 'ID', region: 'Southeast Asia', port: 'Tanjung Priok', riskZone: 'malacca', nearshore: false, railEnabled: false, baseTransitSea: { north: 26, south: 22, med: 20, baltic: 29, blacksea: 24 }, baseFreightSea: { north: 1700, south: 1450, med: 1300, baltic: 1900, blacksea: 1600 } },
  { id: 'manila', name: 'Manila', country: 'Philippines', countryCode: 'PH', region: 'Southeast Asia', port: 'Port of Manila', riskZone: 'south-china-sea', nearshore: false, railEnabled: false, baseTransitSea: { north: 29, south: 25, med: 23, baltic: 32, blacksea: 27 }, baseFreightSea: { north: 1950, south: 1700, med: 1550, baltic: 2150, blacksea: 1850 } },
  { id: 'colombo', name: 'Colombo', country: 'Sri Lanka', countryCode: 'LK', region: 'South Asia', port: 'Port of Colombo', riskZone: 'normal', nearshore: false, railEnabled: false, baseTransitSea: { north: 22, south: 18, med: 16, baltic: 25, blacksea: 20 }, baseFreightSea: { north: 1450, south: 1200, med: 1050, baltic: 1650, blacksea: 1350 } },

  // South Asia (3)
  { id: 'mumbai', name: 'Mumbai', country: 'India', countryCode: 'IN', region: 'South Asia', port: 'JNPT (Nhava Sheva)', riskZone: 'normal', nearshore: false, railEnabled: false, baseTransitSea: { north: 20, south: 16, med: 14, baltic: 23, blacksea: 18 }, baseFreightSea: { north: 1350, south: 1100, med: 950, baltic: 1550, blacksea: 1250 } },
  { id: 'chennai', name: 'Chennai', country: 'India', countryCode: 'IN', region: 'South Asia', port: 'Chennai Port Trust', riskZone: 'normal', nearshore: false, railEnabled: false, baseTransitSea: { north: 21, south: 17, med: 15, baltic: 24, blacksea: 19 }, baseFreightSea: { north: 1400, south: 1150, med: 1000, baltic: 1600, blacksea: 1300 } },
  { id: 'dhaka', name: 'Dhaka', country: 'Bangladesh', countryCode: 'BD', region: 'South Asia', port: 'Chittagong Port', riskZone: 'normal', nearshore: false, railEnabled: false, baseTransitSea: { north: 24, south: 20, med: 18, baltic: 27, blacksea: 22 }, baseFreightSea: { north: 1550, south: 1300, med: 1150, baltic: 1750, blacksea: 1450 } },

  // Middle East (4)
  { id: 'dubai', name: 'Dubai', country: 'UAE', countryCode: 'AE', region: 'Middle East', port: 'Jebel Ali Port (DP World)', riskZone: 'red-sea', nearshore: true, railEnabled: false, baseTransitSea: { north: 16, south: 13, med: 11, baltic: 19, blacksea: 14 }, baseFreightSea: { north: 1100, south: 900, med: 800, baltic: 1300, blacksea: 1000 } },
  { id: 'jeddah', name: 'Jeddah', country: 'Saudi Arabia', countryCode: 'SA', region: 'Middle East', port: 'Jeddah Islamic Port', riskZone: 'red-sea', nearshore: true, railEnabled: false, baseTransitSea: { north: 14, south: 11, med: 9, baltic: 17, blacksea: 12 }, baseFreightSea: { north: 950, south: 750, med: 650, baltic: 1150, blacksea: 850 } },
  { id: 'istanbul', name: 'Istanbul', country: 'Turkey', countryCode: 'TR', region: 'Near East', port: 'Ambarli Container Port', riskZone: 'normal', nearshore: true, railEnabled: false, baseTransitSea: { north: 8, south: 6, med: 5, baltic: 10, blacksea: 4 }, baseFreightSea: { north: 700, south: 550, med: 450, baltic: 850, blacksea: 400 } },
  { id: 'izmir', name: 'Izmir', country: 'Turkey', countryCode: 'TR', region: 'Near East', port: 'Izmir Alsancak Port', riskZone: 'normal', nearshore: true, railEnabled: false, baseTransitSea: { north: 9, south: 7, med: 5, baltic: 11, blacksea: 5 }, baseFreightSea: { north: 750, south: 600, med: 500, baltic: 900, blacksea: 450 } },

  // Americas (4)
  { id: 'new-york', name: 'New York', country: 'USA', countryCode: 'US', region: 'North America', port: 'Port Newark-Elizabeth', riskZone: 'normal', nearshore: false, railEnabled: false, baseTransitSea: { north: 12, south: 14, med: 16, baltic: 14, blacksea: 18 }, baseFreightSea: { north: 950, south: 1100, med: 1250, baltic: 1050, blacksea: 1400 } },
  { id: 'los-angeles', name: 'Los Angeles', country: 'USA', countryCode: 'US', region: 'North America', port: 'Port of Los Angeles', riskZone: 'normal', nearshore: false, railEnabled: false, baseTransitSea: { north: 24, south: 26, med: 28, baltic: 26, blacksea: 30 }, baseFreightSea: { north: 1500, south: 1650, med: 1800, baltic: 1600, blacksea: 1950 } },
  { id: 'santos', name: 'Santos', country: 'Brazil', countryCode: 'BR', region: 'South America', port: 'Port of Santos', riskZone: 'normal', nearshore: false, railEnabled: false, baseTransitSea: { north: 18, south: 16, med: 20, baltic: 20, blacksea: 22 }, baseFreightSea: { north: 1200, south: 1050, med: 1350, baltic: 1300, blacksea: 1500 } },
  { id: 'veracruz', name: 'Veracruz', country: 'Mexico', countryCode: 'MX', region: 'North America', port: 'Port of Veracruz', riskZone: 'normal', nearshore: false, railEnabled: false, baseTransitSea: { north: 20, south: 22, med: 24, baltic: 22, blacksea: 26 }, baseFreightSea: { north: 1300, south: 1450, med: 1600, baltic: 1400, blacksea: 1750 } },

  // Africa (3)
  { id: 'casablanca', name: 'Casablanca', country: 'Morocco', countryCode: 'MA', region: 'North Africa', port: 'Tanger Med / Casablanca', riskZone: 'normal', nearshore: true, railEnabled: false, baseTransitSea: { north: 5, south: 4, med: 3, baltic: 7, blacksea: 5 }, baseFreightSea: { north: 500, south: 400, med: 350, baltic: 650, blacksea: 420 } },
  { id: 'tunis', name: 'Tunis', country: 'Tunisia', countryCode: 'TN', region: 'North Africa', port: 'Rades Port', riskZone: 'normal', nearshore: true, railEnabled: false, baseTransitSea: { north: 6, south: 5, med: 3, baltic: 8, blacksea: 5 }, baseFreightSea: { north: 550, south: 450, med: 350, baltic: 700, blacksea: 430 } },
  { id: 'cape-town', name: 'Cape Town', country: 'South Africa', countryCode: 'ZA', region: 'Sub-Saharan Africa', port: 'Cape Town Container Terminal', riskZone: 'cape-good-hope', nearshore: false, railEnabled: false, baseTransitSea: { north: 24, south: 20, med: 22, baltic: 26, blacksea: 25 }, baseFreightSea: { north: 1600, south: 1350, med: 1500, baltic: 1750, blacksea: 1600 } },

  // Additional origins (4 more to hit 36)
  { id: 'karachi', name: 'Karachi', country: 'Pakistan', countryCode: 'PK', region: 'South Asia', port: 'Karachi Port / QICT', riskZone: 'normal', nearshore: false, railEnabled: false, baseTransitSea: { north: 19, south: 15, med: 13, baltic: 22, blacksea: 17 }, baseFreightSea: { north: 1250, south: 1000, med: 850, baltic: 1450, blacksea: 1150 } },
  { id: 'alexandria', name: 'Alexandria', country: 'Egypt', countryCode: 'EG', region: 'Middle East', port: 'Alexandria Port / Dekheila', riskZone: 'red-sea', nearshore: true, railEnabled: false, baseTransitSea: { north: 10, south: 8, med: 6, baltic: 12, blacksea: 8 }, baseFreightSea: { north: 800, south: 650, med: 550, baltic: 950, blacksea: 620 } },
  { id: 'nairobi', name: 'Nairobi', country: 'Kenya', countryCode: 'KE', region: 'East Africa', port: 'Port of Mombasa', riskZone: 'normal', nearshore: false, railEnabled: false, baseTransitSea: { north: 20, south: 17, med: 19, baltic: 22, blacksea: 21 }, baseFreightSea: { north: 1350, south: 1150, med: 1250, baltic: 1500, blacksea: 1380 } },
  { id: 'lagos', name: 'Lagos', country: 'Nigeria', countryCode: 'NG', region: 'West Africa', port: 'Apapa Port / Tin Can', riskZone: 'normal', nearshore: false, railEnabled: false, baseTransitSea: { north: 14, south: 12, med: 14, baltic: 16, blacksea: 16 }, baseFreightSea: { north: 1000, south: 850, med: 1000, baltic: 1150, blacksea: 1100 } },
];

// ── 5. EU DESTINATIONS (13 true EU ports) ─────────────────────────────────────
export const EU_DESTINATIONS = [
  { id: 'hamburg', name: 'Hamburg', country: 'Germany', countryCode: 'DE', port: 'Port of Hamburg (HHLA)', euZone: 'north', hinterland: 'Central Europe, Austria, Czech Republic', cbamActive: true },
  { id: 'rotterdam', name: 'Rotterdam', country: 'Netherlands', countryCode: 'NL', port: 'Port of Rotterdam (ECT)', euZone: 'north', hinterland: 'Benelux, Western Germany, Switzerland', cbamActive: true },
  { id: 'antwerp', name: 'Antwerp', country: 'Belgium', countryCode: 'BE', port: 'Port of Antwerp-Bruges', euZone: 'north', hinterland: 'Belgium, Northern France, Luxembourg', cbamActive: true },
  { id: 'bremerhaven', name: 'Bremerhaven', country: 'Germany', countryCode: 'DE', port: 'Bremerhaven Container Terminal', euZone: 'north', hinterland: 'Northern Germany, Scandinavia hub', cbamActive: true },
  { id: 'le-havre', name: 'Le Havre', country: 'France', countryCode: 'FR', port: 'Port of Le Havre (HAROPA)', euZone: 'west', hinterland: 'Paris Basin, Normandy, Western France', cbamActive: true },
  { id: 'marseille', name: 'Marseille', country: 'France', countryCode: 'FR', port: 'Port of Marseille-Fos', euZone: 'south', hinterland: 'Southern France, Lyon corridor', cbamActive: true },
  { id: 'genoa', name: 'Genoa', country: 'Italy', countryCode: 'IT', port: 'Port of Genoa (Voltri MSC)', euZone: 'south', hinterland: 'Northern Italy, Po Valley, Switzerland', cbamActive: true },
  { id: 'barcelona', name: 'Barcelona', country: 'Spain', countryCode: 'ES', port: 'Port of Barcelona (BEST Terminal)', euZone: 'south', hinterland: 'Catalonia, Aragon, Southern France', cbamActive: true },
  { id: 'valencia', name: 'Valencia', country: 'Spain', countryCode: 'ES', port: 'Port of Valencia (MSC Terminal)', euZone: 'south', hinterland: 'Eastern Spain, Iberian Peninsula', cbamActive: true },
  { id: 'piraeus', name: 'Piraeus', country: 'Greece', countryCode: 'GR', port: 'Piraeus Container Terminal (COSCO)', euZone: 'med', hinterland: 'Balkans, Eastern Europe gateway', cbamActive: true },
  { id: 'gdansk', name: 'Gdansk', country: 'Poland', countryCode: 'PL', port: 'Port of Gdansk (DCT)', euZone: 'baltic', hinterland: 'Poland, Baltic States, Belarus gateway', cbamActive: true },
  { id: 'constanta', name: 'Constanta', country: 'Romania', countryCode: 'RO', port: 'Port of Constanta (CSCT)', euZone: 'blacksea', hinterland: 'Romania, Moldova, Ukraine (via Danube)', cbamActive: true },
  { id: 'trieste', name: 'Trieste', country: 'Italy', countryCode: 'IT', port: 'Port of Trieste (SIOT)', euZone: 'med', hinterland: 'Northern Italy, Austria, Hungary, Serbia', cbamActive: true },
];

// ── 6. FREIGHT MODES ──────────────────────────────────────────────────────────
export const FREIGHT_MODES = [
  { id: 'sea-freight', name: 'Sea Freight', icon: '🚢', speedMultiplier: 1.0, costMultiplier: 1.0 },
  { id: 'air-freight', name: 'Air Freight', icon: '✈️', speedMultiplier: 0.12, costMultiplier: 7.5 },
  { id: 'rail-freight', name: 'Rail Freight', icon: '🚂', speedMultiplier: 0.55, costMultiplier: 2.1 },
];

// ── 7. LANE GENERATOR ─────────────────────────────────────────────────────────
export function generateAllLanes() {
  const lanes = [];

  for (const origin of ORIGINS) {
    for (const dest of EU_DESTINATIONS) {
      // Sea Freight — all origins
      lanes.push(buildLane(origin, dest, 'sea-freight'));

      // Air Freight — all origins
      lanes.push(buildLane(origin, dest, 'air-freight'));

      // Rail Freight — only rail-enabled origins (Chinese cities)
      if (origin.railEnabled) {
        lanes.push(buildLane(origin, dest, 'rail-freight'));
      }
    }
  }

  return lanes;
}

function buildLane(origin, dest, freightModeId) {
  const mode = FREIGHT_MODES.find(m => m.id === freightModeId);
  const riskZone = RISK_ZONES[origin.riskZone];
  const euZone = dest.euZone;

  // Base sea freight cost per TEU
  const baseSeaCost = origin.baseFreightSea[euZone] ?? origin.baseFreightSea['north'];
  const baseSeaTransit = origin.baseTransitSea[euZone] ?? origin.baseTransitSea['north'];

  // Apply mode multiplier
  const freightCostPerTEU = Math.round(baseSeaCost * mode.costMultiplier * riskZone.multiplier);
  const transitDays = Math.round(baseSeaTransit * mode.speedMultiplier) + riskZone.timeAddDays;

  // Air freight: calculated per-kg instead — approx 1TEU = 6,000kg chargeable
  const airFreightPerKg = freightModeId === 'air-freight'
    ? +(baseSeaCost * mode.costMultiplier / 6000 * riskZone.multiplier).toFixed(2)
    : null;

  const id = `${origin.id}-to-${dest.id}-${freightModeId}`;

  return {
    id,
    slug: id,
    origin,
    destination: dest,
    freightMode: mode,
    riskZone,
    transitDays,
    freightCostPerTEU,
    airFreightPerKg,
    // SEO metadata
    title: `${mode.name} Cost from ${origin.name} to ${dest.name} | 2026 Crisis Simulator`,
    metaDescription: `Calculate ${mode.name.toLowerCase()} costs from ${origin.name}, ${origin.country} to ${dest.name}, ${dest.country}. Includes EU CBAM carbon costs, import duties, and ${origin.riskZone === 'red-sea' ? 'Red Sea disruption' : origin.riskZone === 'cape-good-hope' ? 'Cape of Good Hope rerouting' : 'risk-adjusted'} freight rates for 2026.`,
    h1: `${origin.name} → ${dest.name} ${mode.name}: Cost & Risk Analysis (2026)`,
    breadcrumb: [
      { label: 'Trade Lane Tools', href: '/' },
      { label: origin.region, href: `/#${origin.region.toLowerCase().replace(/\s+/g, '-')}` },
      { label: `${origin.name} to ${dest.name}`, href: `/${id}` },
    ],
  };
}

// ── 8. COST CALCULATOR ────────────────────────────────────────────────────────
export function calculateLandedCost({ lane, orderQty, unitValueUSD, productCategory, disasterMode = false }) {
  const cat = CBAM_RATES[productCategory] || CBAM_RATES['electronics'];
  const dutyRate = EU_DUTY_RATES[productCategory] ?? 0.065;
  const cbamData = CBAM_RATES[productCategory];
  const unitsPerTEU = PRODUCT_CATEGORIES.find(p => p.id === productCategory)?.unitsPerTEU || 2000;
  const teus = Math.max(1, Math.ceil(orderQty / unitsPerTEU));

  const fobValue = orderQty * unitValueUSD;

  // Freight
  let freightCost = lane.freightCostPerTEU * teus;
  let transitDays = lane.transitDays;

  // Disaster mode adjustments (port strike simulation)
  let disasterSurcharge = 0;
  let disasterDelayDays = 0;
  if (disasterMode) {
    disasterSurcharge = teus * 1400; // Demurrage + emergency rerouting
    disasterDelayDays = 16;
    freightCost *= 1.38; // Insurance & war risk loading
  }

  // Insurance (0.35% CIF value)
  const cifApprox = fobValue + freightCost;
  const insurance = cifApprox * 0.0035;

  // EU Customs Duty
  const customsDuty = fobValue * dutyRate;

  // CBAM (EU Carbon Border Adjustment)
  let cbamCost = 0;
  if (cbamData?.active && lane.destination.cbamActive) {
    const cargoTonnes = (orderQty * unitValueUSD) / 2000; // rough weight proxy
    cbamCost = cargoTonnes * cbamData.co2PerTonne * CARBON_PRICE_EUR * 1.08; // EUR→USD approx
  }

  // Port handling (destination)
  const portHandling = teus * 380;

  const totalLandedCost = fobValue + freightCost + insurance + customsDuty + cbamCost + portHandling + disasterSurcharge;
  const costPerUnit = totalLandedCost / orderQty;
  const finalTransitDays = transitDays + disasterDelayDays;

  return {
    fobValue,
    freightCost,
    insurance,
    customsDuty,
    cbamCost,
    portHandling,
    disasterSurcharge,
    totalLandedCost,
    costPerUnit,
    transitDays: finalTransitDays,
    teus,
  };
}

// ── 9. NEARSHORE COMPARATOR ───────────────────────────────────────────────────
// Mode B: Nearshoring from Turkey or Morocco instead
export function getNearshoreAlternative(destId) {
  const nearshoreOrigins = {
    'north': ORIGINS.find(o => o.id === 'istanbul'),
    'west': ORIGINS.find(o => o.id === 'casablanca'),
    'south': ORIGINS.find(o => o.id === 'tunis'),
    'med': ORIGINS.find(o => o.id === 'istanbul'),
    'baltic': ORIGINS.find(o => o.id === 'istanbul'),
    'blacksea': ORIGINS.find(o => o.id === 'istanbul'),
  };
  const dest = EU_DESTINATIONS.find(d => d.id === destId);
  const nearOrigin = nearshoreOrigins[dest?.euZone] || ORIGINS.find(o => o.id === 'istanbul');
  return buildLane(nearOrigin, dest, 'sea-freight');
}

// ── 10. LOOKUP ────────────────────────────────────────────────────────────────
let _laneCache = null;
export function getLaneById(id) {
  if (!_laneCache) {
    _laneCache = {};
    generateAllLanes().forEach(l => { _laneCache[l.id] = l; });
  }
  return _laneCache[id] || null;
}

export function getAllLaneSlugs() {
  return generateAllLanes().map(l => l.slug);
}
