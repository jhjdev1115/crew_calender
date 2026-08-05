const airportTimeZones: Record<string, string> = {
  DOH: "Asia/Qatar",
  ICN: "Asia/Seoul", GMP: "Asia/Seoul", PUS: "Asia/Seoul", CJU: "Asia/Seoul",
  NRT: "Asia/Tokyo", HND: "Asia/Tokyo", KIX: "Asia/Tokyo", NGO: "Asia/Tokyo", FUK: "Asia/Tokyo",
  PEK: "Asia/Shanghai", PKX: "Asia/Shanghai", PVG: "Asia/Shanghai", CAN: "Asia/Shanghai", CTU: "Asia/Shanghai", SZX: "Asia/Shanghai",
  HKG: "Asia/Hong_Kong", TPE: "Asia/Taipei", MNL: "Asia/Manila",
  BKK: "Asia/Bangkok", HKT: "Asia/Bangkok", HAN: "Asia/Ho_Chi_Minh", SGN: "Asia/Ho_Chi_Minh",
  SIN: "Asia/Singapore", KUL: "Asia/Kuala_Lumpur", CGK: "Asia/Jakarta", DPS: "Asia/Makassar",
  DEL: "Asia/Kolkata", BOM: "Asia/Kolkata", BLR: "Asia/Kolkata", HYD: "Asia/Kolkata", MAA: "Asia/Kolkata", CCU: "Asia/Kolkata", COK: "Asia/Kolkata",
  CMB: "Asia/Colombo", KTM: "Asia/Kathmandu", DAC: "Asia/Dhaka",
  KHI: "Asia/Karachi", LHE: "Asia/Karachi", ISB: "Asia/Karachi",
  DXB: "Asia/Dubai", AUH: "Asia/Dubai", SHJ: "Asia/Dubai", MCT: "Asia/Muscat",
  JED: "Asia/Riyadh", RUH: "Asia/Riyadh", DMM: "Asia/Riyadh", BAH: "Asia/Bahrain", KWI: "Asia/Kuwait",
  AMM: "Asia/Amman", BEY: "Asia/Beirut", TLV: "Asia/Jerusalem", BGW: "Asia/Baghdad", IKA: "Asia/Tehran",
  IST: "Europe/Istanbul", SAW: "Europe/Istanbul", ATH: "Europe/Athens",
  CAI: "Africa/Cairo", CMN: "Africa/Casablanca", ALG: "Africa/Algiers", TUN: "Africa/Tunis",
  ADD: "Africa/Addis_Ababa", NBO: "Africa/Nairobi", DAR: "Africa/Dar_es_Salaam", EBB: "Africa/Kampala",
  JNB: "Africa/Johannesburg", CPT: "Africa/Johannesburg", DUR: "Africa/Johannesburg",
  LOS: "Africa/Lagos", ACC: "Africa/Accra", ABJ: "Africa/Abidjan", KGL: "Africa/Kigali",
  LHR: "Europe/London", LGW: "Europe/London", MAN: "Europe/London", EDI: "Europe/London", DUB: "Europe/Dublin",
  CDG: "Europe/Paris", ORY: "Europe/Paris", AMS: "Europe/Amsterdam", BRU: "Europe/Brussels",
  FRA: "Europe/Berlin", MUC: "Europe/Berlin", BER: "Europe/Berlin",
  ZRH: "Europe/Zurich", GVA: "Europe/Zurich", VIE: "Europe/Vienna", PRG: "Europe/Prague", WAW: "Europe/Warsaw",
  FCO: "Europe/Rome", MXP: "Europe/Rome", MAD: "Europe/Madrid", BCN: "Europe/Madrid", LIS: "Europe/Lisbon",
  CPH: "Europe/Copenhagen", ARN: "Europe/Stockholm", OSL: "Europe/Oslo", HEL: "Europe/Helsinki",
  BUD: "Europe/Budapest", OTP: "Europe/Bucharest", SOF: "Europe/Sofia", BEG: "Europe/Belgrade", ZAG: "Europe/Zagreb",
  JFK: "America/New_York", EWR: "America/New_York", LGA: "America/New_York", BOS: "America/New_York", IAD: "America/New_York", DCA: "America/New_York", ATL: "America/New_York", MIA: "America/New_York", PHL: "America/New_York",
  ORD: "America/Chicago", DFW: "America/Chicago", IAH: "America/Chicago", MSP: "America/Chicago",
  DEN: "America/Denver", PHX: "America/Phoenix",
  LAX: "America/Los_Angeles", SFO: "America/Los_Angeles", SEA: "America/Los_Angeles", PDX: "America/Los_Angeles", SAN: "America/Los_Angeles",
  YYZ: "America/Toronto", YUL: "America/Toronto", YVR: "America/Vancouver",
  MEX: "America/Mexico_City", GRU: "America/Sao_Paulo", GIG: "America/Sao_Paulo", EZE: "America/Argentina/Buenos_Aires",
  SYD: "Australia/Sydney", MEL: "Australia/Melbourne", BNE: "Australia/Brisbane", PER: "Australia/Perth", ADL: "Australia/Adelaide",
  AKL: "Pacific/Auckland", CHC: "Pacific/Auckland",
};

function timeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const zonedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return zonedAsUtc - date.getTime();
}

export function airportLocalDateTimeToDate(
  value: string | null,
  airport: string | null | undefined,
  fallbackTimeZone?: string | null,
) {
  if (!value) return null;
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(value)) {
    const absolute = new Date(value);
    return Number.isNaN(absolute.getTime()) ? null : absolute;
  }
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const timeZone =
    airportTimeZones[String(airport ?? "").toUpperCase()] ??
    (fallbackTimeZone && fallbackTimeZone !== "airport-local"
      ? fallbackTimeZone
      : null);
  if (!timeZone) return null;
  const localAsUtc = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] ?? 0),
  );
  let instant = new Date(localAsUtc);
  instant = new Date(localAsUtc - timeZoneOffsetMs(instant, timeZone));
  instant = new Date(localAsUtc - timeZoneOffsetMs(instant, timeZone));
  return instant;
}
