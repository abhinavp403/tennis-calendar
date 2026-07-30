// Country flags from the 3-letter IOC codes used in the data (players.json and
// rankings.json). We map IOC → ISO 3166-1 alpha-2, then to a regional-indicator
// emoji. Unknown codes return '' so callers can fall back to the raw code.
//
// Note: flag emoji render as flags on macOS, iOS, Android, and most browsers,
// but Windows (Chrome/Edge/Electron) shows the two letters instead — swap this
// for bundled SVGs if Windows flag rendering matters.
const IOC_TO_ISO2 = {
  // Present in the current data
  ARG: 'AR', AUS: 'AU', AUT: 'AT', BEL: 'BE', BLR: 'BY', CAN: 'CA', CHI: 'CL',
  CHN: 'CN', CRO: 'HR', CZE: 'CZ', DEN: 'DK', EGY: 'EG', ESP: 'ES', FRA: 'FR',
  GBR: 'GB', GER: 'DE', GRE: 'GR', HUN: 'HU', ITA: 'IT', JPN: 'JP', KAZ: 'KZ',
  MON: 'MC', NED: 'NL', NOR: 'NO', PER: 'PE', POL: 'PL', ROU: 'RO', RUS: 'RU',
  SRB: 'RS', SUI: 'CH', UKR: 'UA', USA: 'US',
  // Common tennis nations, so future players resolve without a code change
  BRA: 'BR', BUL: 'BG', COL: 'CO', SVK: 'SK', SLO: 'SI', POR: 'PT', FIN: 'FI',
  SWE: 'SE', IND: 'IN', RSA: 'ZA', TPE: 'TW', TUN: 'TN', LAT: 'LV', LTU: 'LT',
  EST: 'EE', GEO: 'GE', BIH: 'BA', ISR: 'IL', MEX: 'MX', NZL: 'NZ', MDA: 'MD',
  CYP: 'CY', LUX: 'LU', IRL: 'IE', ECU: 'EC', BOL: 'BO', URU: 'UY', PAR: 'PY',
  VEN: 'VE', KOR: 'KR', THA: 'TH', PHI: 'PH', INA: 'ID', HKG: 'HK', SGP: 'SG',
  TUR: 'TR', UAE: 'AE', QAT: 'QA', MAR: 'MA', DOM: 'DO', CRC: 'CR',
};

// IOC/3-letter country code → flag emoji, or '' if the code is unknown.
export function countryFlag(code) {
  const iso = IOC_TO_ISO2[(code ?? '').toUpperCase()];
  if (!iso) return '';
  return iso.replace(/./g, c => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65));
}
