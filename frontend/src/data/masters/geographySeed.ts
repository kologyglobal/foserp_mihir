import type { GeoCity, GeoCountry, GeoState } from '../../types/geography'
import { CUSTOMER_COUNTRIES } from '../../config/countries'

const COUNTRY_ISO: Record<string, string> = {
  India: 'IN',
  Afghanistan: 'AF',
  Australia: 'AU',
  Bahrain: 'BH',
  Bangladesh: 'BD',
  Bhutan: 'BT',
  Canada: 'CA',
  China: 'CN',
  France: 'FR',
  Germany: 'DE',
  Indonesia: 'ID',
  Italy: 'IT',
  Japan: 'JP',
  Kenya: 'KE',
  Kuwait: 'KW',
  Malaysia: 'MY',
  Maldives: 'MV',
  Nepal: 'NP',
  Netherlands: 'NL',
  Oman: 'OM',
  Qatar: 'QA',
  'Saudi Arabia': 'SA',
  Singapore: 'SG',
  'South Africa': 'ZA',
  'Sri Lanka': 'LK',
  Switzerland: 'CH',
  Thailand: 'TH',
  'United Arab Emirates': 'AE',
  'United Kingdom': 'GB',
  'United States': 'US',
  Vietnam: 'VN',
}

export const seedGeoCountries: GeoCountry[] = CUSTOMER_COUNTRIES.map((name, index) => ({
  id: `geo-cn-${index}`,
  countryCode: COUNTRY_ISO[name] ?? name.slice(0, 2).toUpperCase(),
  countryName: name,
  isActive: true,
}))

function state(id: string, code: string, name: string): GeoState {
  return { id, stateCode: code, stateName: name, isActive: true }
}

function city(id: string, stateId: string, name: string): GeoCity {
  return { id, stateId, cityName: name, isActive: true }
}

/** All Indian states and union territories (ISO 3166-2:IN codes) */
export const seedGeoStates: GeoState[] = [
  state('geo-st-an', 'AN', 'Andaman and Nicobar Islands'),
  state('geo-st-ap', 'AP', 'Andhra Pradesh'),
  state('geo-st-ar', 'AR', 'Arunachal Pradesh'),
  state('geo-st-as', 'AS', 'Assam'),
  state('geo-st-br', 'BR', 'Bihar'),
  state('geo-st-ch', 'CH', 'Chandigarh'),
  state('geo-st-ct', 'CT', 'Chhattisgarh'),
  state('geo-st-dn', 'DN', 'Dadra and Nagar Haveli and Daman and Diu'),
  state('geo-st-dl', 'DL', 'Delhi'),
  state('geo-st-ga', 'GA', 'Goa'),
  state('geo-st-gj', 'GJ', 'Gujarat'),
  state('geo-st-hr', 'HR', 'Haryana'),
  state('geo-st-hp', 'HP', 'Himachal Pradesh'),
  state('geo-st-jk', 'JK', 'Jammu and Kashmir'),
  state('geo-st-jh', 'JH', 'Jharkhand'),
  state('geo-st-ka', 'KA', 'Karnataka'),
  state('geo-st-kl', 'KL', 'Kerala'),
  state('geo-st-la', 'LA', 'Ladakh'),
  state('geo-st-ld', 'LD', 'Lakshadweep'),
  state('geo-st-mp', 'MP', 'Madhya Pradesh'),
  state('geo-st-mh', 'MH', 'Maharashtra'),
  state('geo-st-mn', 'MN', 'Manipur'),
  state('geo-st-ml', 'ML', 'Meghalaya'),
  state('geo-st-mz', 'MZ', 'Mizoram'),
  state('geo-st-nl', 'NL', 'Nagaland'),
  state('geo-st-or', 'OR', 'Odisha'),
  state('geo-st-py', 'PY', 'Puducherry'),
  state('geo-st-pb', 'PB', 'Punjab'),
  state('geo-st-rj', 'RJ', 'Rajasthan'),
  state('geo-st-sk', 'SK', 'Sikkim'),
  state('geo-st-tn', 'TN', 'Tamil Nadu'),
  state('geo-st-ts', 'TS', 'Telangana'),
  state('geo-st-tr', 'TR', 'Tripura'),
  state('geo-st-up', 'UP', 'Uttar Pradesh'),
  state('geo-st-uk', 'UK', 'Uttarakhand'),
  state('geo-st-wb', 'WB', 'West Bengal'),
]

const CITY_BY_STATE: Record<string, string[]> = {
  'geo-st-an': ['Port Blair'],
  'geo-st-ap': ['Visakhapatnam', 'Vijayawada', 'Tirupati', 'Guntur'],
  'geo-st-ar': ['Itanagar'],
  'geo-st-as': ['Guwahati', 'Dibrugarh', 'Silchar'],
  'geo-st-br': ['Patna', 'Gaya', 'Muzaffarpur'],
  'geo-st-ch': ['Chandigarh'],
  'geo-st-ct': ['Raipur', 'Bhilai', 'Bilaspur'],
  'geo-st-dn': ['Silvassa', 'Daman'],
  'geo-st-dl': ['New Delhi', 'Delhi'],
  'geo-st-ga': ['Panaji', 'Margao', 'Vasco da Gama'],
  'geo-st-gj': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Vapi', 'Gandhinagar', 'Bhavnagar', 'Jamnagar'],
  'geo-st-hr': ['Gurugram', 'Faridabad', 'Panipat', 'Ambala'],
  'geo-st-hp': ['Shimla', 'Solan', 'Dharamshala'],
  'geo-st-jk': ['Srinagar', 'Jammu'],
  'geo-st-jh': ['Ranchi', 'Jamshedpur', 'Dhanbad'],
  'geo-st-ka': ['Bengaluru', 'Mysuru', 'Hubli', 'Mangaluru', 'Belagavi'],
  'geo-st-kl': ['Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur'],
  'geo-st-la': ['Leh'],
  'geo-st-ld': ['Kavaratti'],
  'geo-st-mp': ['Indore', 'Bhopal', 'Jabalpur', 'Gwalior'],
  'geo-st-mh': ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad', 'Thane', 'Navi Mumbai', 'Kolhapur'],
  'geo-st-mn': ['Imphal'],
  'geo-st-ml': ['Shillong'],
  'geo-st-mz': ['Aizawl'],
  'geo-st-nl': ['Kohima', 'Dimapur'],
  'geo-st-or': ['Bhubaneswar', 'Cuttack', 'Rourkela'],
  'geo-st-py': ['Puducherry'],
  'geo-st-pb': ['Ludhiana', 'Amritsar', 'Jalandhar', 'Mohali'],
  'geo-st-rj': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer'],
  'geo-st-sk': ['Gangtok'],
  'geo-st-tn': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem'],
  'geo-st-ts': ['Hyderabad', 'Warangal', 'Karimnagar'],
  'geo-st-tr': ['Agartala'],
  'geo-st-up': ['Lucknow', 'Kanpur', 'Varanasi', 'Noida', 'Ghaziabad', 'Agra'],
  'geo-st-uk': ['Dehradun', 'Haridwar', 'Haldwani'],
  'geo-st-wb': ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri'],
}

export const seedGeoCities: GeoCity[] = Object.entries(CITY_BY_STATE).flatMap(([stateId, cities]) =>
  cities.map((name, index) =>
    city(`geo-ct-${stateId.replace('geo-st-', '')}-${index}`, stateId, name),
  ),
)

/** Common transporter vehicle types */
export const VEHICLE_TYPE_OPTIONS = [
  'Trailer',
  'Flatbed',
  'Low Bed',
  'Container',
  'Tanker',
  'Multi-Axle',
] as const

/** Common customer / lead industries */
export const INDUSTRY_OPTIONS = [
  'Cement',
  'Logistics',
  'Chemical',
  'Oil & Gas',
  'Mining',
  'Construction',
  'FMCG',
  'Steel',
  'Government / PSU',
  'Other',
] as const
