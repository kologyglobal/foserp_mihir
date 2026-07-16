/** Geography reference master — countries, states, and cities for address forms */
export interface GeoCountry {
  id: string
  countryCode: string
  countryName: string
  isActive: boolean
}

export interface GeoState {
  id: string
  stateCode: string
  stateName: string
  isActive: boolean
}

export interface GeoCity {
  id: string
  stateId: string
  cityName: string
  isActive: boolean
}
