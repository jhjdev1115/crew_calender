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

function airportTokens(tokens: PdfToken[]) {
  return tokens
    .map((token) => token.text.trim().toUpperCase())
    .filter((text) => /^[A-Z]{3}$/.test(text) && !nonAirportCodes.has(text));
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
      const airports = airportTokens(column.slice(start + 1, end));
      if (airports.length < 2) continue;
      const flight = blankItem("flight", date);
      flight.depAirport = airports[0];
      flight.arrAirport = airports[1];
      flight.confidence = 0.86;
      items.push(flight);
    }
  }

  const unique = Array.from(
    new Map(
      items.map((item) => [
        [item.type, item.startDate, item.depAirport, item.arrAirport].join("|"),
        item,
      ]),
    ).values(),
  ).sort((a, b) => a.startDate.localeCompare(b.startDate));

  if (!unique.length) {
    throw new Error("이 카타르 로스터에서 비행·휴무·교육 일정을 찾지 못했어요.");
  }

  const dates = unique.map((item) => item.startDate);
  const counts = unique.reduce(
    (acc, item) => ({ ...acc, [item.type]: acc[item.type] + 1 }),
    { flight: 0, off: 0, training: 0 },
  );
  return {
    summary: `비행 ${counts.flight}개 · 휴무 ${counts.off}개 · 교육 ${counts.training}개`,
    periodStart: dates[0],
    periodEnd: dates[dates.length - 1],
    timezoneNote: "PDF 원본은 기기 안에서만 읽었으며 날짜·일정 유형·출도착 공항만 추출했어요.",
    items: unique,
  };
}
