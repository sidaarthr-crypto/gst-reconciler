/** First two digits of Indian GSTIN → state / UT name (for CA dashboard badge). */
const GSTIN_STATE_PREFIX: Record<string, string> = {
  "01": "J&K",
  "02": "HP",
  "03": "Punjab",
  "04": "Chandigarh",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "UP",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "WB",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "CG",
  "23": "MP",
  "24": "Gujarat",
  "25": "DD",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "36": "Telangana",
  "37": "AP",
}

export function stateNameFromGstinPrefix(gstin: string | null | undefined): string | null {
  if (!gstin || gstin.length < 2) return null
  const prefix = gstin.slice(0, 2).toUpperCase()
  return GSTIN_STATE_PREFIX[prefix] ?? null
}
