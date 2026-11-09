import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowRight, ArrowUpRight, BadgeCheck, Bookmark, BookmarkCheck, BriefcaseBusiness,
  CalendarDays, Check, CircleDollarSign, Clock3, Globe2, Heart, MapPin,
  RotateCcw, Search, SlidersHorizontal, Sparkles, X,
} from 'lucide-react';

type Job = {
  id: string;
  title: string;
  company: string;
  category: string;
  location: string;
  workMode: 'Remote' | 'Hybrid' | 'On-site';
  employmentType: 'Full-time' | 'Contract' | 'Part-time';
  salaryMin: number;
  salaryMax: number;
  currency: string;
  salaryPeriod: string;
  timezone: string;
  description: string;
  requirements: string[];
  postedAt: string;
  verified: boolean;
  applyUrl: string | null;
}

type Preferences = { categories: string[]; timeZone: string; minimumSalary: number };
type SavedState = { preferences: Preferences; savedIds: string[]; postedJobs: Job[] };

const categories = ['Engineering', 'Design & Product', 'Operations', 'Finance', 'Sales & Marketing', 'Customer Success', 'People & HR', 'Other'];
const modes = ['Remote', 'Hybrid', 'On-site'];
const types = ['Full-time', 'Contract', 'Part-time'];
const zoneOptions = ['Any timezone', 'UTC−8 to UTC−4', 'UTC−5 to UTC+1', 'UTC−3 to UTC+3', 'UTC to UTC+5', 'UTC+1 to UTC+8'];
const initialPreferences: Preferences = { categories: [], timeZone: 'Any timezone', minimumSalary: 0 };

const seededJobs: Job[] = [
  { id:'ta-101',title:'Senior Product Designer',company:'Mosaic Health',category:'Design & Product',location:'Remote · Africa, Europe',workMode:'Remote',employmentType:'Full-time',salaryMin:72000,salaryMax:96000,currency:'USD',salaryPeriod:'year',timezone:'UTC−5 to UTC+2',description:'Shape a calmer, more human healthcare experience for millions. You will work across research, service design and product UI with a thoughtful team distributed across four continents.',requirements:['5+ years designing digital products','Strong systems thinking and prototyping practice','Fluent collaboration with product and engineering'],postedAt:'Today',verified:false,applyUrl:'#'},
  { id:'ta-102',title:'Regional Finance Manager',company:'Kora Commerce',category:'Finance',location:'Nairobi, Kenya · Hybrid',workMode:'Hybrid',employmentType:'Full-time',salaryMin:54000,salaryMax:76000,currency:'USD',salaryPeriod:'year',timezone:'UTC+3',description:'Build reliable financial operations across a fast-growing commerce network. Partner closely with local teams and global leadership to turn good data into better decisions.',requirements:['CPA, ACCA or equivalent qualification','Experience across multiple African markets','Comfortable building a finance function as you go'],postedAt:'1 day ago',verified:false,applyUrl:'#'},
  { id:'ta-103',title:'People Operations Partner',company:'Northstar Learning',category:'People & HR',location:'Remote · Africa',workMode:'Remote',employmentType:'Full-time',salaryMin:48000,salaryMax:68000,currency:'USD',salaryPeriod:'year',timezone:'UTC−2 to UTC+4',description:'Help a 120-person learning company grow with care. Own the moments that shape employee experience, from thoughtful onboarding to manager coaching and people programs.',requirements:['4+ years in people operations or HR','Experience supporting distributed teams','Clear, empathetic written communication'],postedAt:'2 days ago',verified:false,applyUrl:'#'},
  { id:'ta-104',title:'Customer Success Lead',company:'Tandem Cloud',category:'Customer Success',location:'Remote · EMEA',workMode:'Remote',employmentType:'Full-time',salaryMin:62000,salaryMax:84000,currency:'USD',salaryPeriod:'year',timezone:'UTC−1 to UTC+5',description:'Make complex software feel simple for the people who use it. Lead a small customer success team and shape the playbook for a growing international customer base.',requirements:['Track record leading customer success teams','Strong discovery and account planning skills','Experience with B2B SaaS products'],postedAt:'2 days ago',verified:false,applyUrl:'#'},
  { id:'ta-105',title:'Operations & Logistics Manager',company:'Sankofa Supply',category:'Operations',location:'Accra, Ghana · On-site',workMode:'On-site',employmentType:'Full-time',salaryMin:42000,salaryMax:61000,currency:'USD',salaryPeriod:'year',timezone:'UTC',description:'Turn a complex regional supply chain into a dependable customer promise. Bring rigor to daily operations and build strong relationships with a network of local partners.',requirements:['5+ years in supply chain or operations','Experience managing vendor relationships','A practical, data-informed approach'],postedAt:'3 days ago',verified:false,applyUrl:'#'},
  { id:'ta-106',title:'Growth Marketing Manager',company:'Fieldnote',category:'Sales & Marketing',location:'Remote · Africa, Europe',workMode:'Remote',employmentType:'Contract',salaryMin:4500,salaryMax:6200,currency:'USD',salaryPeriod:'month',timezone:'UTC−4 to UTC+3',description:'Own the experiments that introduce an independent publishing platform to its next million readers. A six-month contract with room to make a lasting mark.',requirements:['4+ years in growth or performance marketing','Comfortable owning channel budgets','Excellent analytical storytelling'],postedAt:'4 days ago',verified:false,applyUrl:'#'},
  { id:'ta-107',title:'Backend Engineer, Payments',company:'LumenPay',category:'Engineering',location:'Remote · Africa',workMode:'Remote',employmentType:'Full-time',salaryMin:84000,salaryMax:116000,currency:'USD',salaryPeriod:'year',timezone:'UTC−5 to UTC+3',description:'Build reliable payment infrastructure for businesses moving money across borders. Join a product-minded engineering team where clear writing is as valued as clean code.',requirements:['5+ years building production APIs','Strong experience with distributed systems','Payments or fintech experience is a plus'],postedAt:'5 days ago',verified:false,applyUrl:'#'},
  { id:'ta-108',title:'Account Executive, Enterprise',company:'Aster Systems',category:'Sales & Marketing',location:'Johannesburg, South Africa · Hybrid',workMode:'Hybrid',employmentType:'Full-time',salaryMin:70000,salaryMax:104000,currency:'USD',salaryPeriod:'year',timezone:'UTC+2',description:'Help ambitious teams modernize how they work. Own a considered enterprise sales cycle and collaborate with product teams to make every customer conversation count.',requirements:['5+ years in consultative B2B sales','Experience closing multi-stakeholder deals','Strong discovery and presentation skills'],postedAt:'6 days ago',verified:false,applyUrl:'#'},
  { id:'ta-109',title:'Program Coordinator, Climate',company:'Open Canopy',category:'Other',location:'Remote · Africa',workMode:'Remote',employmentType:'Contract',salaryMin:3800,salaryMax:5200,currency:'USD',salaryPeriod:'month',timezone:'UTC−2 to UTC+4',description:'Coordinate a portfolio of locally led climate initiatives. You will keep a thoughtful network of partners connected, funded and moving toward measurable outcomes.',requirements:['Experience coordinating cross-functional programs','Excellent partner communication','Interest in community-led climate work'],postedAt:'1 week ago',verified:false,applyUrl:'#'},
  { id:'ta-110',title:'Product Manager, Marketplace',company:'Common Ground',category:'Design & Product',location:'Remote · Africa, Europe',workMode:'Remote',employmentType:'Full-time',salaryMin:78000,salaryMax:108000,currency:'USD',salaryPeriod:'year',timezone:'UTC−4 to UTC+3',description:'Set the direction for a marketplace that helps independent businesses find their next customers. Bring customer insight, crisp prioritization and a bias for learning.',requirements:['4+ years in product management','Experience with two-sided marketplaces','Strong written product thinking'],postedAt:'1 week ago',verified:false,applyUrl:'#'},
  { id:'ta-111',title:'Research Associate',company:'Meridian Insights',category:'Finance',location:'Lagos, Nigeria · On-site',workMode:'On-site',employmentType:'Part-time',salaryMin:26000,salaryMax:36000,currency:'USD',salaryPeriod:'year',timezone:'UTC+1',description:'Support a sharp, curious team making investment decisions across emerging markets. Blend qualitative research and careful analysis into concise, useful insight.',requirements:['Background in economics, finance or research','Excellent desk research and synthesis','Careful attention to detail'],postedAt:'1 week ago',verified:false,applyUrl:'#'},
  { id:'ta-112',title:'Visual Designer',company:'Little Atlas Studio',category:'Design & Product',location:'Remote · Global',workMode:'Remote',employmentType:'Contract',salaryMin:3800,salaryMax:5200,currency:'USD',salaryPeriod:'month',timezone:'UTC−6 to UTC+4',description:'Give a new generation of travel brands a distinct visual voice. This six-month contract spans brand systems, campaigns and digital experiences with a small independent studio.',requirements:['Portfolio showing a confident visual point of view','Experience across brand and digital design','Independent, generous collaborator'],postedAt:'2 weeks ago',verified:false,applyUrl:'#'},
  { id:'ta-113',title:'Workplace & Office Coordinator',company:'Monument Capital',category:'Operations',location:'Cape Town, South Africa · On-site',workMode:'On-site',employmentType:'Full-time',salaryMin:31000,salaryMax:44000,currency:'USD',salaryPeriod:'year',timezone:'UTC+2',description:'Create a welcoming, well-run home base for a growing investment team. Keep the day-to-day running beautifully while building the small systems that make work easier.',requirements:['Experience in workplace or office operations','Warm and resourceful communication','Comfortable balancing planned and ad hoc work'],postedAt:'2 weeks ago',verified:false,applyUrl:'#'},
  { id:'ta-114',title:'Partnerships Associate',company:'BrightPath Foundation',category:'Other',location:'Remote · Africa',workMode:'Remote',employmentType:'Part-time',salaryMin:2300,salaryMax:3200,currency:'USD',salaryPeriod:'month',timezone:'UTC−3 to UTC+3',description:'Help a mission-driven education foundation build durable partnerships. Support thoughtful outreach, keep relationships warm and bring order to the details behind great collaboration.',requirements:['2+ years in partnerships, fundraising or account support','Excellent organization and follow-through','A genuine interest in education access'],postedAt:'3 weeks ago',verified:false,applyUrl:'#'},
];

function loadState(): SavedState {
  const fallback = { preferences: initialPreferences, savedIds: [], postedJobs: [] };
  try {
    const raw = localStorage.getItem('taskaway-demo-state-v1');
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<SavedState>;
    const sanitizedState = {
      preferences: { ...initialPreferences, ...(parsed.preferences || {}) },
      savedIds: Array.isArray(parsed.savedIds) ? parsed.savedIds : [],
      postedJobs: Array.isArray(parsed.postedJobs) ? parsed.postedJobs : [],
    };
    localStorage.setItem('taskaway-demo-state-v1', JSON.stringify(sanitizedState));
    return sanitizedState;
  } catch { return fallback; }
}

function getEmployerApplicationUrl(job: Job): URL | null {
  if (!job.verified || typeof job.applyUrl !== 'string' || !job.applyUrl.trim()) return null;
  try {
    const url = new URL(job.applyUrl);
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      !host.includes('.') ||
      ['.localhost', '.local', '.internal', '.test', '.invalid'].some(suffix => host.endsWith(suffix))
    ) return null;
    return url;
  } catch {
    return null;
  }
}

const money = (job: Job) => {
  const fmt = (value: number) => value >= 1000 ? `${Math.round(value / 1000)}k` : value.toLocaleString();
  return `${job.currency} ${fmt(job.salaryMin)}–${fmt(job.salaryMax)} / ${job.salaryPeriod}`;
};
const initials = (company: string) => company.split(/\s+/).map(word => word[0]).join('').slice(0, 2).toUpperCase();
const annualMaximum = (job: Job) => job.salaryPeriod === 'month' ? job.salaryMax * 12 : job.salaryPeriod === 'hour' ? job.salaryMax * 2080 : job.salaryMax;
const timezoneOffsets = (range: string) => [...range.matchAll(/UTC([−+]\d+)?/g)].map(match => match[1] ? Number(match[1].replace('−', '-')) : 0);
const timezoneOverlap = (jobRange: string, preference: string) => {
  if (preference === 'Any timezone') return true;
  const job = timezoneOffsets(jobRange);
  const desired = timezoneOffsets(preference);
  const jobEnd = job.length === 1 ? job[0] : job[1];
  const desiredEnd = desired.length === 1 ? desired[0] : desired[1];
  return job.length > 0 && desired.length > 0 && Math.max(job[0], desired[0]) <= Math.min(jobEnd, desiredEnd);
};

function App() {
  const [state, setState] = useState<SavedState>(loadState);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All fields');
  const [modeFilter, setModeFilter] = useState('All work modes');
  const [typeFilter, setTypeFilter] = useState('All employment');
  const [sort, setSort] = useState('Recommended');
  const [savedOnly, setSavedOnly] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [dialogMode, setDialogMode] = useState<'details' | 'apply'>('details');
  const [applicationNotice, setApplicationNotice] = useState('');
  const [toast, setToast] = useState('');
  const [postNotice, setPostNotice] = useState('');
  const [postForm, setPostForm] = useState({ title:'', company:'', category:'Engineering', location:'', workMode:'Remote', employmentType:'Full-time', salaryMin:'', salaryMax:'', currency:'USD', salaryPeriod:'year', timezone:'UTC−5 to UTC+3', description:'' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { try { localStorage.setItem('taskaway-demo-state-v1', JSON.stringify(state)); } catch { /* Storage is optional. */ } }, [state]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const allJobs = useMemo(() => [...state.postedJobs, ...seededJobs], [state.postedJobs]);
  const visibleJobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = allJobs.filter(job => {
      const matchQuery = !q || [job.title, job.company, job.category, job.location].join(' ').toLowerCase().includes(q);
      const matchCategory = categoryFilter === 'All fields' || job.category === categoryFilter;
      const matchMode = modeFilter === 'All work modes' || job.workMode === modeFilter;
      const matchType = typeFilter === 'All employment' || job.employmentType === typeFilter;
      const matchSaved = !savedOnly || state.savedIds.includes(job.id);
      const matchSalary = !state.preferences.minimumSalary || annualMaximum(job) >= state.preferences.minimumSalary;
      const matchApplication = !job.verified || getEmployerApplicationUrl(job) !== null;
      return matchQuery && matchCategory && matchMode && matchType && matchSaved && matchSalary && matchApplication;
    });
    if (sort === 'Highest pay') list.sort((a, b) => b.salaryMax - a.salaryMax);
    else if (sort === 'Newest') list.sort((a, b) => a.postedAt.localeCompare(b.postedAt));
    else list.sort((a, b) => {
      const categoryRank = Number(state.preferences.categories.includes(b.category)) - Number(state.preferences.categories.includes(a.category));
      const timezoneRank = Number(timezoneOverlap(b.timezone, state.preferences.timeZone)) - Number(timezoneOverlap(a.timezone, state.preferences.timeZone));
      return categoryRank || timezoneRank;
    });
    return list;
  }, [allJobs, query, categoryFilter, modeFilter, typeFilter, sort, savedOnly, state.savedIds, state.preferences.minimumSalary, state.preferences.categories]);

  const updatePreferences = (update: Partial<Preferences>) => setState(current => ({ ...current, preferences: { ...current.preferences, ...update } }));
  const resetFilters = () => { setQuery(''); setCategoryFilter('All fields'); setModeFilter('All work modes'); setTypeFilter('All employment'); setSort('Recommended'); setSavedOnly(false); };
  const toggleSave = (job: Job) => {
    setState(current => ({ ...current, savedIds: current.savedIds.includes(job.id) ? current.savedIds.filter(id => id !== job.id) : [...current.savedIds, job.id] }));
    setToast(state.savedIds.includes(job.id) ? 'Removed from saved roles.' : 'Saved for later. Your list stays on this device.');
  };
  const openDetails = (job: Job, mode: 'details' | 'apply' = 'details') => { setSelectedJob(job); setDialogMode(mode); setApplicationNotice(''); };
  const togglePreferenceCategory = (category: string) => {
    const next = state.preferences.categories.includes(category) ? state.preferences.categories.filter(item => item !== category) : [...state.preferences.categories, category];
    updatePreferences({ categories: next });
  };
  const resetPreferences = () => { updatePreferences(initialPreferences); setToast('Your preferences have been reset.'); };
  const openPostSection = () => document.getElementById('employers')?.scrollIntoView({ behavior: 'smooth' });

  const submitRole = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (Number(postForm.salaryMax) < Number(postForm.salaryMin)) {
      setPostNotice('The upper salary range must be at least the lower range.');
      return;
    }
    setSubmitting(true);
    window.setTimeout(() => {
      const newJob: Job = {
        ...postForm, id:`demo-${Date.now()}`, salaryMin:Number(postForm.salaryMin), salaryMax:Number(postForm.salaryMax),
        title:postForm.title.trim(), company:postForm.company.trim(), location:postForm.location.trim(),
        category:postForm.category, workMode:postForm.workMode as Job['workMode'], employmentType:postForm.employmentType as Job['employmentType'],
        currency:postForm.currency, salaryPeriod:postForm.salaryPeriod, description:postForm.description.trim(),
        requirements:['Employer-submitted preview; review and verify role details before publication.'],
        postedAt:'Just submitted', verified:false, applyUrl:null,
      };
      setState(current => ({ ...current, postedJobs:[newJob, ...current.postedJobs] }));
      setPostForm({ title:'', company:'', category:'Engineering', location:'', workMode:'Remote', employmentType:'Full-time', salaryMin:'', salaryMax:'', currency:'USD', salaryPeriod:'year', timezone:'UTC−5 to UTC+3', description:'' });
      setPostNotice('Preview created on this device. Nothing was sent or published.');
      setSubmitting(false);
      setToast('Role preview added to your results.');
    }, 450);
  };

  return (
    <div className="app-shell grain">
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#top" aria-label="TaskAway home" data-testid="link-home">
            <span className="brand-mark"><ArrowUpRight size={18} strokeWidth={2.5} /></span>TaskAway
          </a>
          <nav className="nav-links" aria-label="Main navigation">
            <button type="button" onClick={() => { setSavedOnly(false); document.getElementById('roles')?.scrollIntoView({ behavior:'smooth' }); }} data-testid="nav-discover">Discover roles</button>
            <button type="button" className="saved-link" onClick={() => { setSavedOnly(value => !value); document.getElementById('roles')?.scrollIntoView({ behavior:'smooth' }); }} aria-pressed={savedOnly} data-testid="nav-saved">
              Saved <span className="saved-count" data-testid="count-saved">{state.savedIds.length}</span>
            </button>
            <button type="button" className="nav-post" onClick={openPostSection} data-testid="nav-post-role">For employers <ArrowUpRight size={14} /></button>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="hero-wrap">
          <div className="hero">
            <div className="rise">
              <div className="eyebrow"><span className="eyebrow-dot" /> A wider world of work</div>
              <h1>Your next chapter has <em>no borders.</em></h1>
              <p className="hero-copy">A more considered way to find good work with global teams. Explore meaningful roles across every field, with pay and work style out in the open.</p>
              <ul className="hero-proof">
                <li><Check size={14} /> Pay ranges up front</li>
                <li><Globe2 size={14} /> Work from your world</li>
                <li><Heart size={14} /> Built for African talent</li>
              </ul>
            </div>
            <aside className="hero-side rise" aria-label="Opportunity snapshot">
              <div className="side-top"><span>Open doors, not just listings</span><Sparkles size={16} /></div>
              <div className="side-number">Work, your way.</div>
              <p className="side-desc">Global opportunities across industries and work styles.</p>
              <div className="side-roles">
                <div className="side-role"><span className="mini-logo">MH</span><strong>Senior Product Designer</strong><span>Remote</span></div>
                <div className="side-role"><span className="mini-logo">KC</span><strong>Regional Finance Manager</strong><span>Hybrid</span></div>
                <div className="side-role"><span className="mini-logo">SL</span><strong>People Operations Partner</strong><span>Remote</span></div>
              </div>
            </aside>
          </div>
        </section>

        <section className="main-content" id="roles">
          <div className="section-head">
            <div>
              <p className="section-kicker">{savedOnly ? 'Kept close for later' : 'Find work that fits'}</p>
              <h2 className="section-title">{savedOnly ? 'Your saved roles' : 'Opportunities with room to grow'}</h2>
            </div>
            <div className="head-count" aria-live="polite" data-testid="text-results-count">{visibleJobs.length} {visibleJobs.length === 1 ? 'role' : 'roles'} to explore</div>
          </div>

          <div className="search-row">
            <label className="search-box"><Search size={17} aria-hidden="true" /><input type="search" aria-label="Search jobs" placeholder="Search title, company, field or location" value={query} onChange={event => setQuery(event.target.value)} data-testid="input-job-search" /></label>
            <select className="select-control" value={sort} onChange={event => setSort(event.target.value)} aria-label="Sort opportunities" data-testid="select-sort">
              <option>Recommended</option><option>Newest</option><option>Highest pay</option>
            </select>
            <button className="select-control" type="button" onClick={() => document.getElementById('preferences')?.scrollIntoView({ behavior:'smooth', block:'center' })} data-testid="button-preferences"><SlidersHorizontal size={14} /> Preferences</button>
          </div>

          <div className="filter-bar" aria-label="Opportunity filters">
            <span className="filter-label"><BriefcaseBusiness size={14} /> Field</span>
            <button type="button" className={`filter-chip ${categoryFilter === 'All fields' ? 'active' : ''}`} onClick={() => setCategoryFilter('All fields')} aria-pressed={categoryFilter === 'All fields'} data-testid="filter-category-all">All fields</button>
            {categories.map(category => <button key={category} type="button" className={`filter-chip ${categoryFilter === category ? 'active' : ''}`} onClick={() => setCategoryFilter(categoryFilter === category ? 'All fields' : category)} aria-pressed={categoryFilter === category} data-testid={`filter-category-${category.toLowerCase().replace(/[^a-z]+/g,'-')}`}>{category}</button>)}
            <span className="filter-label"><Globe2 size={14} /> Work style</span>
            {modes.map(mode => <button key={mode} type="button" className={`filter-chip ${modeFilter === mode ? 'active' : ''}`} onClick={() => setModeFilter(modeFilter === mode ? 'All work modes' : mode)} aria-pressed={modeFilter === mode} data-testid={`filter-mode-${mode.toLowerCase()}`}>{mode}</button>)}
            <span className="filter-label"><Clock3 size={14} /> Commitment</span>
            {types.map(type => <button key={type} type="button" className={`filter-chip ${typeFilter === type ? 'active' : ''}`} onClick={() => setTypeFilter(typeFilter === type ? 'All employment' : type)} aria-pressed={typeFilter === type} data-testid={`filter-type-${type.toLowerCase()}`}>{type}</button>)}
            {(query || categoryFilter !== 'All fields' || modeFilter !== 'All work modes' || typeFilter !== 'All employment' || savedOnly) && <button className="clear-filters" type="button" onClick={resetFilters} data-testid="button-clear-filters">Clear filters</button>}
          </div>

          <div className="layout">
            <div className="job-list" aria-live="polite" data-testid="list-opportunities">
              {visibleJobs.length ? visibleJobs.map((job, index) => {
                const isSaved = state.savedIds.includes(job.id);
                return <article className="job-card rise" key={job.id} style={{ animationDelay:`${Math.min(index * 35, 210)}ms` }} data-testid={`card-job-${job.id}`}>
                  <div className="job-top">
                    <div className="company-line">
                      <div className={`company-logo ${['ta-102','ta-106','ta-111'].includes(job.id) ? 'c2' : ['ta-103','ta-109','ta-112'].includes(job.id) ? 'c3' : ['ta-104','ta-108','ta-113'].includes(job.id) ? 'c4' : ''}`} aria-hidden="true">{initials(job.company)}</div>
                      <div><p className="company-name" data-testid={`text-company-${job.id}`}>{job.company}</p><h3 className="job-title" data-testid={`text-title-${job.id}`}>{job.title}</h3></div>
                    </div>
                    <button type="button" className={`bookmark-btn ${isSaved ? 'saved' : ''}`} onClick={() => toggleSave(job)} aria-label={isSaved ? `Remove ${job.title} from saved roles` : `Save ${job.title}`} aria-pressed={isSaved} data-testid={`button-save-${job.id}`}>{isSaved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}</button>
                  </div>
                  <div className="job-meta">
                    <span className="category-tag">{job.category}</span><span className="compensation"><CircleDollarSign size={13} />{money(job)}</span>
                    <span><MapPin size={13} />{job.location}</span><span><Globe2 size={13} />{job.workMode}</span>
                    <span><BriefcaseBusiness size={13} />{job.employmentType}</span><span><CalendarDays size={13} />{job.postedAt}</span>
                  </div>
                  <p className="job-summary">{job.description}</p>
                  <div className="job-bottom">
                    <span className="trust-label"><BadgeCheck size={13} /> {getEmployerApplicationUrl(job) ? 'Verified listing · employer application link available' : job.verified ? 'Verified listing · application link unavailable' : 'Sample opportunity · no verified application link'}</span>
                    <div className="card-actions">
                      <button className="btn btn-outline" type="button" onClick={() => openDetails(job)} data-testid={`button-details-${job.id}`}>View role</button>
                      <button className="btn btn-accent" type="button" onClick={() => openDetails(job,'apply')} data-testid={`button-apply-${job.id}`}>{getEmployerApplicationUrl(job) ? 'Apply on employer site' : 'Application info'} <ArrowUpRight size={13} /></button>
                    </div>
                  </div>
                </article>;
              }) : <div className="empty-state" data-testid="empty-opportunities">
                <div className="empty-icon"><Search size={19} /></div>
                <h3>{savedOnly && state.savedIds.length === 0 ? 'Your shortlist starts here.' : 'No roles in this corner yet.'}</h3>
                <p>{savedOnly && state.savedIds.length === 0 ? 'Save opportunities that catch your eye and they will be waiting here.' : 'Try another search or relax a filter. New possibilities can come from unexpected places.'}</p>
                <button type="button" className="btn" onClick={resetFilters} data-testid="button-reset-search"><RotateCcw size={14} /> Reset search</button>
              </div>}
            </div>

            <aside className="side-panel" id="preferences" aria-labelledby="preferences-title">
              <div>
                <p className="section-kicker">Your compass</p>
                <h3 id="preferences-title">Shape your matches</h3>
                <p>Choose what matters. Your preferences stay on this device and are never shared.</p>
              </div>
              <div className="pref-field">
                <label htmlFor="pref-category">Fields you’re curious about</label>
                <select id="pref-category" value={state.preferences.categories[0] || ''} onChange={event => updatePreferences({ categories:event.target.value ? [event.target.value] : [] })} data-testid="select-preference-category">
                  <option value="">Show me a mix</option>{categories.map(category => <option key={category} value={category}>{category}</option>)}
                </select>
              </div>
              <div className="pref-field">
                <label htmlFor="pref-zone">Time zone</label>
                <select id="pref-zone" value={state.preferences.timeZone} onChange={event => updatePreferences({ timeZone:event.target.value })} data-testid="select-preference-timezone">{zoneOptions.map(zone => <option key={zone}>{zone}</option>)}</select>
              </div>
              <div className="pref-field">
                <label htmlFor="pref-salary">Minimum annual pay</label>
                <input id="pref-salary" type="range" min="0" max="150000" step="10000" value={state.preferences.minimumSalary} onChange={event => updatePreferences({ minimumSalary:Number(event.target.value) })} aria-label="Minimum annual compensation" data-testid="range-preference-salary" />
                <div className="range-caption"><span>Any</span><strong data-testid="text-minimum-salary">{state.preferences.minimumSalary ? `${state.preferences.minimumSalary.toLocaleString()} USD+` : 'Any range'}</strong><span>$150k+</span></div>
              </div>
              <p className="pref-foot demo-note">Salary preferences are matched against annual roles. Monthly ranges remain visible in the listing.</p>
              <button type="button" className="btn btn-outline" onClick={resetPreferences} data-testid="button-reset-preferences"><RotateCcw size={13} /> Reset preferences</button>
            </aside>
          </div>
        </section>

        <section className="employer-band" id="employers">
          <div className="employer-inner">
            <div className="employer-copy">
              <div className="eyebrow"><span className="eyebrow-dot" /> For teams building everywhere</div>
              <h2>Good people are closer than you think.</h2>
              <p>Make the shape of the role clear. Share an honest salary range, how the team works and where someone can do their best work.</p>
              <ul className="employer-points"><li><Check size={15} /> Reach professionals across Africa</li><li><Check size={15} /> Show pay and work style from day one</li><li><Check size={15} /> A listing preview, not a live submission</li></ul>
              <p className="demo-note">This prototype stores role previews only in this browser. No listing is published or sent for review.</p>
            </div>
            <form className="post-form" onSubmit={submitRole} data-testid="form-submit-role">
              <h3>Preview a role</h3>
              <p>See how an opportunity might appear to candidates. No contact details needed.</p>
              {postNotice && <div className="notice" role="status" data-testid="status-role-submit">{postNotice}</div>}
              <div className="form-grid">
                <div className="field"><label htmlFor="post-title">Role title</label><input id="post-title" required maxLength={80} value={postForm.title} onChange={event => setPostForm({ ...postForm,title:event.target.value })} placeholder="e.g. Senior Finance Analyst" data-testid="input-role-title" /></div>
                <div className="field"><label htmlFor="post-company">Organization</label><input id="post-company" required maxLength={60} value={postForm.company} onChange={event => setPostForm({ ...postForm,company:event.target.value })} placeholder="Organization name" data-testid="input-role-company" /></div>
                <div className="field"><label htmlFor="post-category">Job family</label><select id="post-category" value={postForm.category} onChange={event => setPostForm({ ...postForm,category:event.target.value })} data-testid="select-role-category">{categories.map(category => <option key={category}>{category}</option>)}</select></div>
                <div className="field"><label htmlFor="post-location">Location</label><input id="post-location" required maxLength={80} value={postForm.location} onChange={event => setPostForm({ ...postForm,location:event.target.value })} placeholder="City, country or region" data-testid="input-role-location" /></div>
                <div className="field"><label htmlFor="post-mode">Work mode</label><select id="post-mode" value={postForm.workMode} onChange={event => setPostForm({ ...postForm,workMode:event.target.value })} data-testid="select-role-workmode">{modes.map(mode => <option key={mode}>{mode}</option>)}</select></div>
                <div className="field"><label htmlFor="post-type">Employment type</label><select id="post-type" value={postForm.employmentType} onChange={event => setPostForm({ ...postForm,employmentType:event.target.value })} data-testid="select-role-type">{types.map(type => <option key={type}>{type}</option>)}</select></div>
                <div className="field"><label htmlFor="post-min">Pay range from</label><input id="post-min" type="number" min="1" required value={postForm.salaryMin} onChange={event => setPostForm({ ...postForm,salaryMin:event.target.value })} placeholder="e.g. 65000" data-testid="input-role-salary-min" /></div>
                <div className="field"><label htmlFor="post-max">Pay range to</label><input id="post-max" type="number" min="1" required value={postForm.salaryMax} onChange={event => setPostForm({ ...postForm,salaryMax:event.target.value })} placeholder="e.g. 85000" data-testid="input-role-salary-max" /></div>
                <div className="field"><label htmlFor="post-currency">Currency</label><select id="post-currency" value={postForm.currency} onChange={event => setPostForm({ ...postForm,currency:event.target.value })} data-testid="select-role-currency"><option>USD</option><option>EUR</option><option>GBP</option><option>NGN</option><option>KES</option><option>ZAR</option><option>GHS</option></select></div>
                <div className="field"><label htmlFor="post-period">Pay period</label><select id="post-period" value={postForm.salaryPeriod} onChange={event => setPostForm({ ...postForm,salaryPeriod:event.target.value })} data-testid="select-role-period"><option value="year">Per year</option><option value="month">Per month</option><option value="hour">Per hour</option></select></div>
                <div className="field full-field"><label htmlFor="post-timezone">Team timezone / overlap</label><input id="post-timezone" maxLength={50} value={postForm.timezone} onChange={event => setPostForm({ ...postForm,timezone:event.target.value })} data-testid="input-role-timezone" /></div>
                <div className="field full-field"><label htmlFor="post-description">What makes this role worth a look?</label><textarea id="post-description" rows={3} maxLength={500} required value={postForm.description} onChange={event => setPostForm({ ...postForm,description:event.target.value })} placeholder="Tell candidates about the work, team and impact." data-testid="textarea-role-description" /></div>
              </div>
              <button className="btn btn-accent" type="submit" disabled={submitting} data-testid="button-submit-role">{submitting ? 'Preparing preview…' : 'Create role preview'} <ArrowRight size={14} /></button>
            </form>
          </div>
        </section>
      </main>
      <footer className="footer"><div><strong>TaskAway</strong><div>Global work, made more accessible.</div></div><span>Applications continue on the employer’s site. TaskAway does not collect or track them.</span></footer>

      {selectedJob && <div className="overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedJob(null); }}>
        <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" data-testid="dialog-job">
          <button className="dialog-close" type="button" aria-label="Close opportunity details" onClick={() => setSelectedJob(null)} data-testid="button-close-dialog"><X size={17} /></button>
          <div className="eyebrow" style={{ color:'#59785b' }}><span className="eyebrow-dot" style={{ background:'#97b843' }} /> {dialogMode === 'apply' ? 'Application preview' : 'Opportunity details'}</div>
          <h2 id="dialog-title" data-testid="text-dialog-job-title">{selectedJob.title}</h2>
          <div className="dialog-company"><div className="company-logo">{initials(selectedJob.company)}</div><div><strong>{selectedJob.company}</strong><p>{selectedJob.location}</p></div></div>
          <div className="job-meta"><span className="category-tag">{selectedJob.category}</span><span className="compensation"><CircleDollarSign size={13} />{money(selectedJob)}</span><span><Globe2 size={13} />{selectedJob.workMode}</span><span><BriefcaseBusiness size={13} />{selectedJob.employmentType}</span></div>
          {dialogMode === 'apply' && (getEmployerApplicationUrl(selectedJob) ? (
            <div className="notice" style={{ marginTop:16 }} data-testid="notice-apply-external">
              Continue to <strong>{getEmployerApplicationUrl(selectedJob)?.hostname}</strong> to apply. You’ll provide any application details directly to the employer. TaskAway does not receive or record your application.
              {applicationNotice && <p className="application-status" role="status" data-testid="status-application-handoff">{applicationNotice}</p>}
            </div>
          ) : (
            <div className="notice" style={{ marginTop:16 }} data-testid="notice-apply-unavailable">
              This listing has no verified employer application link. TaskAway cannot submit or forward an application for this role.
            </div>
          ))}
          <div className="dialog-section"><h3>About the role</h3><p>{selectedJob.description}</p></div>
          <div className="dialog-section"><h3>What you’ll bring</h3><ul>{selectedJob.requirements.map(requirement => <li key={requirement}>{requirement}</li>)}</ul></div>
          <div className="dialog-section"><h3>Working together</h3><p>Timezone: {selectedJob.timezone}. {selectedJob.verified ? 'Employer details have been verified.' : 'This sample opportunity is provided for product demonstration and has not been independently verified.'}</p></div>
          <div className="dialog-actions">
            {getEmployerApplicationUrl(selectedJob) && <a
              className="btn btn-accent"
              href={getEmployerApplicationUrl(selectedJob)?.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setApplicationNotice(`Opening ${getEmployerApplicationUrl(selectedJob)?.hostname} in a new tab. TaskAway will not receive the application or a submission confirmation.`)}
              data-testid="link-employer-application"
            ><ArrowUpRight size={14} /> Continue to employer site</a>}
            <button className="btn btn-outline" type="button" onClick={() => toggleSave(selectedJob)} data-testid="button-dialog-save">{state.savedIds.includes(selectedJob.id) ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}{state.savedIds.includes(selectedJob.id) ? 'Saved' : 'Save role'}</button>
            <button className="btn btn-outline" type="button" onClick={() => setSelectedJob(null)} data-testid="button-dialog-close-secondary">Close</button>
          </div>
        </section>
      </div>}
      {toast && <div className="toast" role="status" aria-live="polite" data-testid="status-toast">{toast}</div>}
    </div>
  );
}

export default App;
