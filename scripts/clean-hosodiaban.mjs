import fs from 'node:fs';

const filePath = 'src/components/HoSoDiaBanManager.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const startIdx = content.indexOf('const DEFAULT_DIA_BAN_DATA: DiaBanRecord[] = [');
const endIdx = content.indexOf('export function HoSoDiaBanManager({ user }: Props) {');

if (startIdx !== -1 && endIdx !== -1) {
  const replacement = `const DEFAULT_DIA_BAN_DATA: DiaBanRecord[] = [];
const DEFAULT_HO_SO_FILES: HoSoDiaBanFile[] = [];
const DEFAULT_BAO_CAO_THANG_DATA: BaoCaoThangItem[] = [];

`;
  content = content.slice(0, startIdx) + replacement + content.slice(endIdx);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully cleaned mock data in HoSoDiaBanManager.tsx!');
} else {
  console.log('Markers not found:', startIdx, endIdx);
}
