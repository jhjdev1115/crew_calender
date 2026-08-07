import { airportLocalDateTimeToDate } from "./airport-timezones";

export type LocalRosterItem = {
  id: string;
  sourceCode: string;
  type: "flight" | "off" | "training";
  startDate: string;
  endDate: string;
  startAt: string;
  endAt: string;
  flightNo: string;
  depAirport: string;
  arrAirport: string;
  aircraft: string;
  layoverCity: string;
  hotelName: string;
  note: string;
  confidence: number;
};

export type LocalRosterAnalysis = {
  summary: string;
  periodStart: string;
  periodEnd: string;
  timezoneNote: string;
  items: LocalRosterItem[];
};

export type PdfToken = {
  page: number;
  text: string;
  x: number;
  y: number;
  width: number;
};

const monthNumbers: Record<string, string> = {
  JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
  JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
};

const trainingCodes = new Set([
  "FAID", "RECI", "REC", "SEC", "DGCS", "CRMR", "CRM", "SEP",
  "AVMED", "GROUND", "TRAINING",
]);

const nonAirportCodes = new Set([
  "ACT", "ALL", "CCM", "DOF", "DOFF", "DUT", "FAI", "LVE", "NOA",
  "OFF", "REC", "REQ", "RPT", "SEC", "SIM", "SNY", "STB", "UTC",
]);

function isoDate(dayMonth: string, year: string) {
  const match = dayMonth.toUpperCase().match(/^(\d{2})([A-Z]{3})$/);
  const month = match ? monthNumbers[match[2]] : null;
  return match && month ? `${year}-${month}-${match[1]}` : "";
}

function nearestHeader(token: PdfToken, headers: PdfToken[]) {
  let nearest: PdfToken | null = null;
  let distance = Number.POSITIVE_INFINITY;
  for (const header of headers) {
    if (header.page !== token.page) continue;
    const current = Math.abs(token.x + token.width / 2 - (header.x + header.width / 2));
    if (current < distance) {
      distance = current;
      nearest = header;
    }
  }
  return distance <= 25 ? nearest : null;
}

function blankItem(type: LocalRosterItem["type"], date: string): LocalRosterItem {
  return {
    id: crypto.randomUUID(),
    sourceCode: "",
    type,
    startDate: date,
    endDate: "",
    startAt: "",
    endAt: "",
    flightNo: "",
    depAirport: "",
    arrAirport: "",
    aircraft: "",
    layoverCity: "",
    hotelName: "",
    note: "",
    confidence: 0.9,
  };
}

function normalizedValue(token: PdfToken) {
  return token.text.trim().toUpperCase();
}

function timeValue(value: string) {
  return value.match(/^(\d{2}):(\d{2})(?:\(\+?\d+\))?$/)?.slice(1, 3).join(":") ?? "";
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function arrivalDate(
  date: string,
  departureTime: string,
  arrivalTime: string,
  departureAirport: string,
  arrivalAirport: string,
) {
  const departure = airportLocalDateTimeToDate(
    `${date}T${departureTime}`,
    departureAirport,
    "airport-local",
  );
  for (let dayOffset = 0; dayOffset <= 2; dayOffset += 1) {
    const candidate = addDays(date, dayOffset);
    const arrival = airportLocalDateTimeToDate(
      `${candidate}T${arrivalTime}`,
      arrivalAirport,
      "airport-local",
    );
    if (!departure || !arrival || arrival.getTime() > departure.getTime()) return candidate;
  }
  return addDays(date, 1);
}

function firstIndexAfter(values: string[], start: number, predicate: (value: string) => boolean) {
  for (let index = start; index < values.length; index += 1) {
    if (predicate(values[index])) return index;
  }
  return -1;
}

function parseFlightBlock(block: PdfToken[], date: string) {
  const values = block.map(normalizedValue);
  const flightNo = values[0];
  if (!/^\d{2,4}$/.test(flightNo)) return null;

  const departureIndex = firstIndexAfter(
    values,
    1,
    (value) => /^[A-Z]{3}$/.test(value) && !nonAirportCodes.has(value),
  );
  if (departureIndex < 0) return null;
  const departureTimeIndex = firstIndexAfter(values, departureIndex + 1, (value) => Boolean(timeValue(value)));
  if (departureTimeIndex < 0) return null;
  const arrivalIndex = firstIndexAfter(
    values,
    departureTimeIndex + 1,
    (value) => /^[A-Z]{3}$/.test(value) && !nonAirportCodes.has(value),
  );
  if (arrivalIndex < 0) return null;
  const arrivalTimeIndex = firstIndexAfter(values, arrivalIndex + 1, (value) => Boolean(timeValue(value)));
  if (arrivalTimeIndex < 0) return null;

  const departureTime = timeValue(values[departureTimeIndex]);
  const arrivalTime = timeValue(values[arrivalTimeIndex]);
  const departureAirport = values[departureIndex];
  const arrivalAirport = values[arrivalIndex];
  const endDate = arrivalDate(
    date,
    departureTime,
    arrivalTime,
    departureAirport,
    arrivalAirport,
  );
  const flight = blankItem("flight", "");
  flight.sourceCode = flightNo;
  flight.flightNo = flightNo;
  flight.depAirport = departureAirport;
  flight.arrAirport = arrivalAirport;
  flight.startAt = `${date}T${departureTime}`;
  flight.endAt = `${endDate}T${arrivalTime}`;
  flight.confidence = 0.94;
  return flight;
}

export function analyzeRosterTokens(tokens: PdfToken[]): LocalRosterAnalysis {
  const joined = tokens.map((token) => token.text).join(" ");
  const period = joined.match(
    /(?:Period\s*:\s*)?(\d{2})[-/]([A-Za-z]{3})[-/](\d{4})\s*[-–]\s*(\d{2})[-/]([A-Za-z]{3})[-/](\d{4})/i,
  );
  const year = period?.[3] ?? String(new Date().getFullYear());
  const headers = tokens.filter((token) => /^\d{2}[A-Za-z]{3}$/.test(token.text.trim()));
  const grouped = new Map<string, PdfToken[]>();

  for (const token of tokens) {
    const header = nearestHeader(token, headers);
    if (!header || token.y >= header.y || token.text === header.text) continue;
    const key = `${header.page}:${header.text}:${header.x.toFixed(1)}`;
    const list = grouped.get(key) ?? [];
    list.push(token);
    grouped.set(key, list);
  }

  const items: LocalRosterItem[] = [];
  for (const header of headers) {
    const date = isoDate(header.text.trim(), year);
    if (!date) continue;
    const key = `${header.page}:${header.text}:${header.x.toFixed(1)}`;
    const column = (grouped.get(key) ?? []).sort((a, b) => b.y - a.y || a.x - b.x);
    const values = column.map((token) => token.text.trim().toUpperCase()).filter(Boolean);

    if (values.some((value) => /^(?:OFF|DOFF|LVE)$/.test(value))) {
      items.push(blankItem("off", date));
    }
    if (values.some((value) => trainingCodes.has(value) || /^\d{1,3}DR$/.test(value))) {
      items.push(blankItem("training", date));
    }

    const numberIndexes = values.flatMap((value, index) =>
      /^\d{2,4}$/.test(value) ? [index] : [],
    );
    for (let index = 0; index < numberIndexes.length; index += 1) {
      const start = numberIndexes[index];
      const end = numberIndexes[index + 1] ?? values.length;
      const flight = parseFlightBlock(column.slice(start, end), date);
      if (flight) items.push(flight);
    }
  }

  const unique = Array.from(
    new Map(
      items.map((item) => [
        [item.type, item.startDate || item.startAt, item.flightNo, item.depAirport, item.arrAirport].join("|"),
        item,
      ]),
    ).values(),
  ).sort((a, b) =>
    (a.startDate || a.startAt.slice(0, 10)).localeCompare(
      b.startDate || b.startAt.slice(0, 10),
    ),
  );

  if (!unique.length) {
    throw new Error("이 카타르 로스터에서 비행·휴무·교육 일정을 찾지 못했어요.");
  }

  const dates = unique.map((item) => item.startDate || item.startAt.slice(0, 10));
  const counts = unique.reduce(
    (acc, item) => ({ ...acc, [item.type]: acc[item.type] + 1 }),
    { flight: 0, off: 0, training: 0 },
  );
  return {
    summary: `비행 ${counts.flight}개 · 휴무 ${counts.off}개 · 교육 ${counts.training}개`,
    periodStart: dates[0],
    periodEnd: dates[dates.length - 1],
    timezoneNote: "PDF 원본은 기기 안에서만 읽었으며 날짜·편명·출도착 공항·현지 시각만 추출했어요.",
    items: unique,
  };
}
