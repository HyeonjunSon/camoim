// 캐나다 주요 대학교 이메일 도메인 화이트리스트
const UNIVERSITIES = [
  { name: 'University of Toronto', shortName: 'University of Toronto (UofT)', domains: ['mail.utoronto.ca', 'utoronto.ca'] },
  { name: 'University of British Columbia', shortName: 'University of British Columbia (UBC)', domains: ['student.ubc.ca', 'ubc.ca'] },
  { name: 'McGill University', shortName: 'McGill University', domains: ['mail.mcgill.ca', 'mcgill.ca'] },
  { name: 'University of Alberta', shortName: 'University of Alberta (UAlberta)', domains: ['ualberta.ca'] },
  { name: 'University of Waterloo', shortName: 'University of Waterloo (UW)', domains: ['uwaterloo.ca'] },
  { name: 'Western University', shortName: 'Western University', domains: ['uwo.ca'] },
  { name: "Queen's University", shortName: "Queen's University", domains: ['queensu.ca'] },
  { name: 'Simon Fraser University', shortName: 'Simon Fraser University (SFU)', domains: ['sfu.ca'] },
  { name: 'University of Calgary', shortName: 'University of Calgary (UCalgary)', domains: ['ucalgary.ca'] },
  { name: 'University of Ottawa', shortName: 'University of Ottawa (uOttawa)', domains: ['uottawa.ca'] },
  { name: 'York University', shortName: 'York University', domains: ['yorku.ca'] },
  { name: 'University of Victoria', shortName: 'University of Victoria (UVic)', domains: ['uvic.ca'] },
  { name: 'Dalhousie University', shortName: 'Dalhousie University (Dal)', domains: ['dal.ca'] },
  { name: 'University of Manitoba', shortName: 'University of Manitoba (UManitoba)', domains: ['umanitoba.ca'] },
  { name: 'BCIT', shortName: 'British Columbia Institute of Technology (BCIT)', domains: ['bcit.ca', 'my.bcit.ca'] },
  { name: 'Seneca College', shortName: 'Seneca College', domains: ['myseneca.ca'] },
  { name: 'George Brown College', shortName: 'George Brown College', domains: ['georgebrown.ca'] },
  { name: 'Humber College', shortName: 'Humber College', domains: ['humber.ca', 'humberc.ca'] },
  { name: 'SAIT', shortName: 'Southern Alberta Institute of Technology (SAIT)', domains: ['sait.ca', 'my.sait.ca'] },
  { name: 'Langara College', shortName: 'Langara College', domains: ['langara.ca'] },
];

// 기존 shortName → 새 shortName 매핑 (DB 마이그레이션용)
const SHORT_NAME_MIGRATION = {
  // 괄호 공백 오류 수정
  'University of Toronto(UofT)': 'University of Toronto (UofT)',
  'University of British Columbia(UBC)': 'University of British Columbia (UBC)',
  // 단순 약어 → 풀네임
  'UofT': 'University of Toronto (UofT)',
  'UBC': 'University of British Columbia (UBC)',
  'McGill': 'McGill University',
  'UAlberta': 'University of Alberta (UAlberta)',
  'Waterloo': 'University of Waterloo (UW)',
  'UW': 'University of Waterloo (UW)',
  'Western': 'Western University',
  "Queen's": "Queen's University",
  'SFU': 'Simon Fraser University (SFU)',
  'UCalgary': 'University of Calgary (UCalgary)',
  'uOttawa': 'University of Ottawa (uOttawa)',
  'Ottawa': 'University of Ottawa (uOttawa)',
  'York': 'York University',
  'UVic': 'University of Victoria (UVic)',
  'Dal': 'Dalhousie University (Dal)',
  'UManitoba': 'University of Manitoba (UManitoba)',
  'McMaster': 'McMaster University',
  'Carleton': 'Carleton University',
  'TMU': 'Toronto Metropolitan University',
  'Ryerson': 'Toronto Metropolitan University',
  'USask': 'University of Saskatchewan',
  'BCIT': 'British Columbia Institute of Technology (BCIT)',
  'Seneca': 'Seneca College',
  'George Brown': 'George Brown College',
  'Humber': 'Humber College',
  'SAIT': 'Southern Alberta Institute of Technology (SAIT)',
  'Langara': 'Langara College',
  // name 필드(풀네임) → shortName 통일
  'University of Toronto': 'University of Toronto (UofT)',
  'University of British Columbia': 'University of British Columbia (UBC)',
  'University of Alberta': 'University of Alberta (UAlberta)',
  'University of Waterloo': 'University of Waterloo (UW)',
  'Simon Fraser University': 'Simon Fraser University (SFU)',
  'University of Calgary': 'University of Calgary (UCalgary)',
  'University of Ottawa': 'University of Ottawa (uOttawa)',
  'University of Victoria': 'University of Victoria (UVic)',
  'Dalhousie University': 'Dalhousie University (Dal)',
  'University of Manitoba': 'University of Manitoba (UManitoba)',
};

// 이메일 도메인으로 대학교 찾기
function findUniversityByEmail(email) {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return null;
  return UNIVERSITIES.find(u => u.domains.includes(domain)) || null;
}

module.exports = { UNIVERSITIES, SHORT_NAME_MIGRATION, findUniversityByEmail };
