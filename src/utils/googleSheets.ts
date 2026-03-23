import Papa from 'papaparse';

export interface ReadyNote {
  name: string;
  content: string;
}

const SHEET_ID = '1bt6gW9w5jmKDmyAnUy_SF98tQ6xF3yJsRVI4bvyTnXs';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
const JSON_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;

export async function fetchReadyNotes(): Promise<ReadyNote[]> {
  try {
    // Try JSON first as it's usually cleaner
    const response = await fetch(JSON_URL);
    if (response.ok) {
      const text = await response.text();
      // The JSON response from Google Sheets gviz API is wrapped in a callback
      const jsonStr = text.match(/google\.visualization\.Query\.setResponse\((.*)\);/)?.[1];
      if (jsonStr) {
        const data = JSON.parse(jsonStr);
        const rows = data.table.rows;
        // Skip header row (row 0)
        return rows.map((row: any) => ({
          name: row.c[0]?.v || 'Untitled Note',
          content: row.c[1]?.v || ''
        })).filter((note: ReadyNote) => note.content);
      }
    }
  } catch (error) {
    console.warn('Failed to fetch JSON, falling back to CSV', error);
  }

  // Fallback to CSV
  try {
    const response = await fetch(CSV_URL);
    if (!response.ok) throw new Error('Failed to fetch CSV');
    const csvText = await response.text();
    
    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          const data = results.data as string[][];
          if (data.length < 2) {
            resolve([]);
            return;
          }
          // Skip header row
          const notes = data.slice(1).map(row => ({
            name: row[0] || 'Untitled Note',
            content: row[1] || ''
          })).filter(note => note.content);
          resolve(notes);
        },
        error: (error: any) => reject(error)
      });
    });
  } catch (error) {
    console.error('Failed to fetch Ready Notes:', error);
    throw error;
  }
}

export function getCachedReadyNotes(): ReadyNote[] | null {
  const cached = localStorage.getItem('arcane-ready-notes');
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      return null;
    }
  }
  return null;
}

export function cacheReadyNotes(notes: ReadyNote[]) {
  localStorage.setItem('arcane-ready-notes', JSON.stringify(notes));
}
