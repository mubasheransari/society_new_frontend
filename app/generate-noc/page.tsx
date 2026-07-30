"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ImagePreview from "../components/ImagePreview";

type NocData = {
  plotNo: string;
  ownerName: string;
  remaining: number;
  canIssue: boolean;
  issuedAt: string;
  templateMeta?: Record<string, { label: string; required: string[] }>;
};

type NocUpdate = { sender?: string; message?: string; imageUrls?: string[]; createdAt?: string };

type AdminNocRequest = {
  id: string | number;
  plot_no?: string;
  plotNo?: string;
  request_type?: string;
  requestType?: string;
  notes?: string;
  status?: string;
  admin_message?: string;
  adminMessage?: string;
  updates?: NocUpdate[];
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
};

type AdminIssuedNoc = {
  id: string | number;
  plot_no?: string;
  plotNo?: string;
  noc_number?: string;
  nocNumber?: string;
  noc_type?: string;
  nocType?: string;
  status?: string;
  issued_at?: string;
  issuedAt?: string;
};

type TemplateKey = "sale" | "noDues" | "water" | "gas" | "electricity" | "building" | "verification" | "construction" | "transfer";
type RelationType = "S/O" | "W/O" | "D/O";
type OwnerType = "Owner" | "Allottee" | "Transferee" | "Applicant";

type NocFields = {
  plotMeasure: string;
  relationType: RelationType;
  relationName: string;
  cnic: string;
  applicantName: string;
  ownerType: OwnerType;
  duesClearDate: string;
  remarks: string;
  buildingType: string;
  transferredName: string;
  transferFromName: string;
  transferFromRelationType: RelationType;
  transferFromRelationName: string;
  transferLetterDate: string;
  allotmentOrderNo: string;
  allotmentOrderDate: string;
  recipientAddress: string;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000").replace(/\/$/, "");

const templates: Record<TemplateKey, string> = {
  sale: "NOC FOR SALE",
  noDues: "NO DUES CERTIFICATE",
  water: "NOC FOR WATER CONNECTION",
  gas: "NOC FOR SUPPLY OF GAS CONNECTION",
  electricity: "NOC FOR SUPPLY OF ELECTRICITY CONNECTION",
  building: "FORWARDED FOR APPROVAL OF BUILDING PLAN",
  verification: "VERIFICATION",
  construction: "NOC FOR CONSTRUCTION",
  transfer: "TRANSFER OF PLOT",
};

const societyLine1 = "Lucknow Co-operative Housing Society Ltd";
const societyLine2 = "Sector 31-E Korangi Karachi";
const signName = "MALIK FAHAD";
const signTitle = "SECRETARY";
const signOrg = "Lucknow Co-operative Housing Society Ltd";

const templateFieldMap: Record<TemplateKey, Array<keyof NocFields>> = {
  sale: ["applicantName", "relationType", "relationName", "plotMeasure"],
  noDues: ["applicantName", "relationType", "relationName", "plotMeasure", "duesClearDate"],
  water: ["applicantName", "relationType", "relationName", "plotMeasure", "cnic"],
  gas: ["applicantName", "relationType", "relationName", "plotMeasure", "ownerType"],
  electricity: ["applicantName", "relationType", "relationName", "plotMeasure", "ownerType"],
  building: ["plotMeasure", "buildingType", "transferredName", "relationType", "relationName"],
  verification: ["applicantName", "relationType", "relationName", "plotMeasure"],
  construction: ["applicantName", "relationType", "relationName", "plotMeasure"],
  transfer: ["applicantName", "relationType", "relationName", "recipientAddress", "transferFromName", "transferFromRelationType", "transferFromRelationName", "transferLetterDate", "allotmentOrderNo", "allotmentOrderDate", "plotMeasure"],
};

const defaultFields: NocFields = {
  plotMeasure: "",
  relationType: "S/O",
  relationName: "",
  cnic: "",
  applicantName: "",
  ownerType: "Owner",
  duesClearDate: "",
  remarks: "Vacant",
  buildingType: "",
  transferredName: "",
  transferFromName: "",
  transferFromRelationType: "S/O",
  transferFromRelationName: "",
  transferLetterDate: "",
  allotmentOrderNo: "",
  allotmentOrderDate: "",
  recipientAddress: "",
};

function readFiles(files: FileList | null) {
  return Promise.all(Array.from(files || []).map((file) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  })));
}

function qrImage(text: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(text)}`;
}

function sanitizeLine(value: string) {
  return (value || "").trim() || "________________";
}

function displayNocType(value?: string) {
  return String(value || '-')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function displayDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function extractList(json: any): any[] {
  if (Array.isArray(json)) return json;
  if (!json || typeof json !== 'object') return [];
  const directKeys = ['items', 'results', 'data', 'result', 'rows', 'nocs', 'issuedNocs', 'issued_nocs', 'requests', 'nocRequests'];
  for (const key of directKeys) {
    if (Array.isArray(json[key])) return json[key];
  }
  for (const value of Object.values(json)) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

async function fetchFirstAvailable(paths: string[]) {
  let lastError = 'Unable to load data';
  for (const path of paths) {
    try {
      const res = await fetch(`${API_BASE}${path}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (res.ok) return extractList(json);
      lastError = json?.message || lastError;
    } catch (error: any) {
      lastError = error?.message || lastError;
    }
  }
  throw new Error(lastError);
}

async function loadIssuedNocsWithFallback() {
  const directPaths = ['/api/nocs', '/api/noc/issued', '/api/admin/nocs', '/api/noc/all'];
  for (const path of directPaths) {
    try {
      const res = await fetch(`${API_BASE}${path}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        const rows = extractList(json);
        if (rows.length) return rows;
      }
    } catch {}
  }

  // Older backend versions expose issued NOCs only plot-by-plot.
  // Load plot numbers, then merge /api/noc/history/:plotNo results.
  const duesRes = await fetch(`${API_BASE}/api/dues`, { cache: 'no-store' });
  const duesJson = await duesRes.json().catch(() => ([]));
  if (!duesRes.ok) throw new Error(duesJson?.message || 'Failed to load plot records');
  const houses = extractList(duesJson);
  const plots = [...new Set(houses.map((item: any) => String(item.plotNo || item.plot_no || '').trim()).filter(Boolean))];
  const historyResults = await Promise.allSettled(
    plots.map(async (plotNo) => {
      const res = await fetch(`${API_BASE}/api/noc/history/${encodeURIComponent(plotNo)}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return [];
      return extractList(json).map((item: any) => ({ ...item, plot_no: item.plot_no || item.plotNo || plotNo }));
    })
  );
  return historyResults.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
}

export default function GenerateNocPage() {
  const [plot, setPlot] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<NocData | null>(null);
  const [template, setTemplate] = useState<TemplateKey>("noDues");
  const [generated, setGenerated] = useState(false);
  const [nocId, setNocId] = useState("");
  const [savedQrImage, setSavedQrImage] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{ plotNo: string; ownerName: string }>>([]);
  const [fields, setFields] = useState<NocFields>(defaultFields);
  const loadedPlotRef = useRef<string>("");
  const [adminRequests, setAdminRequests] = useState<AdminNocRequest[]>([]);
  const [adminIssuedNocs, setAdminIssuedNocs] = useState<AdminIssuedNoc[]>([]);
  const [nocListSearch, setNocListSearch] = useState('');
  const [nocListsLoading, setNocListsLoading] = useState(false);
  const [nocListsError, setNocListsError] = useState('');
  const [expandedRequestId, setExpandedRequestId] = useState<string | number | null>(null);
  const [nocDrafts, setNocDrafts] = useState<Record<string, { message: string; imageUrls: string[] }>>({});
  const [nocActionBusyId, setNocActionBusyId] = useState<string | number | null>(null);
  const [nocActionMessage, setNocActionMessage] = useState('');

  const loadNocLists = async () => {
    setNocListsLoading(true);
    setNocListsError('');
    const results = await Promise.allSettled([
      fetchFirstAvailable(['/api/noc/requests', '/api/noc/requests/all', '/api/admin/noc-requests']),
      loadIssuedNocsWithFallback(),
    ]);
    if (results[0].status === 'fulfilled') setAdminRequests(results[0].value);
    if (results[1].status === 'fulfilled') setAdminIssuedNocs(results[1].value);
    if (results.every((r) => r.status === 'rejected')) {
      setNocListsError('NOC lists could not be loaded. Confirm the admin NOC list routes in the backend.');
    }
    setNocListsLoading(false);
  };

  useEffect(() => {
    loadNocLists();
  }, []);

  const toggleRequestView = (id: string | number) => {
    setExpandedRequestId((prev) => (prev === id ? null : id));
    setNocActionMessage('');
  };

  async function approveAndIssueNoc(item: AdminNocRequest) {
    try {
      setNocActionBusyId(item.id);
      setNocListsError('');
      setNocActionMessage('');
      const res = await fetch(`${API_BASE}/api/noc/requests/${item.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to approve request');
      setNocActionMessage(json.message || 'Request approved and NOC issued.');
      await loadNocLists();
    } catch (e: any) {
      setNocListsError(e?.message || 'Failed to approve request');
    } finally {
      setNocActionBusyId(null);
    }
  }

  async function updateNocRequestStatus(item: AdminNocRequest, status: 'APPROVED' | 'DECLINED') {
    try {
      setNocActionBusyId(item.id);
      setNocListsError('');
      const res = await fetch(`${API_BASE}/api/noc/requests/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to update request');
      setNocActionMessage(json.message || `Request ${status.toLowerCase()}`);
      await loadNocLists();
    } catch (e: any) {
      setNocListsError(e?.message || 'Failed to update request');
    } finally {
      setNocActionBusyId(null);
    }
  }

  async function sendNocRequestMessage(item: AdminNocRequest) {
    const key = String(item.id);
    const draft = nocDrafts[key] || { message: '', imageUrls: [] };
    if (!draft.message.trim() && !draft.imageUrls.length) return;
    try {
      setNocActionBusyId(item.id);
      setNocListsError('');
      const res = await fetch(`${API_BASE}/api/noc/requests/${item.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: 'admin', message: draft.message, imageUrls: draft.imageUrls }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to send message');
      setNocDrafts((prev) => ({ ...prev, [key]: { message: '', imageUrls: [] } }));
      setNocActionMessage(json.message || 'Message sent');
      await loadNocLists();
    } catch (e: any) {
      setNocListsError(e?.message || 'Failed to send message');
    } finally {
      setNocActionBusyId(null);
    }
  }

  const filteredRequests = useMemo(() => {
    const q = nocListSearch.trim().toLowerCase();
    if (!q) return adminRequests;
    return adminRequests.filter((item) =>
      [item.plot_no, item.plotNo, item.request_type, item.requestType, item.status, item.notes]
        .some((value) => String(value || '').toLowerCase().includes(q))
    );
  }, [adminRequests, nocListSearch]);

  const filteredIssuedNocs = useMemo(() => {
    const q = nocListSearch.trim().toLowerCase();
    if (!q) return adminIssuedNocs;
    return adminIssuedNocs.filter((item) =>
      [item.plot_no, item.plotNo, item.noc_number, item.nocNumber, item.noc_type, item.nocType, item.status]
        .some((value) => String(value || '').toLowerCase().includes(q))
    );
  }, [adminIssuedNocs, nocListSearch]);

  const requiredFields = templateFieldMap[template];
  const clearGeneratedState = () => {
    setGenerated(false);
    setNocId("");
    setSavedQrImage("");
  };

  const setFieldValue = <K extends keyof NocFields>(key: K, value: NocFields[K]) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    setErr(null);
    clearGeneratedState();
  };

  useEffect(() => {
    const q = plot.trim();

    if (!q) {
      loadedPlotRef.current = "";
      setSuggestions([]);
      setData(null);
      setErr(null);
      clearGeneratedState();
      return;
    }

    if (data?.plotNo && q.toLowerCase() !== data.plotNo.toLowerCase()) {
      setData(null);
      setErr(null);
      clearGeneratedState();
    }

    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/dues/suggestions?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        if (!res.ok) return;
        const items = Array.isArray(json) ? json : [];
        setSuggestions(items);

        const exact = items.find((s) => s.plotNo.toLowerCase() === q.toLowerCase());
        if (exact && loadedPlotRef.current.toLowerCase() !== exact.plotNo.toLowerCase()) {
          fetchNoc(exact.plotNo);
        }
      } catch {}
    }, 220);
    return () => clearTimeout(t);
  }, [plot]);

  const fetchNoc = async (inputPlot = plot) => {
    const q = inputPlot.trim();
    if (!q) return setErr("Plot No. is required");
    setErr(null);
    setLoading(true);
    setGenerated(false);
    try {
      const res = await fetch(`${API_BASE}/api/noc?plot=${encodeURIComponent(q)}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message || "Failed");
      setData(j);
      loadedPlotRef.current = j.plotNo || q;
      setPlot(j.plotNo || q);
      setFields((prev) => ({
        ...prev,
        applicantName: j.ownerName || prev.applicantName,
        relationType: prev.relationType && prev.relationType !== "S/O" ? prev.relationType : (j.relationType || prev.relationType),
        relationName: prev.relationName || j.relationName || "",
        plotMeasure: prev.plotMeasure || j.plotMeasureSqYds || "",
        cnic: prev.cnic || j.ownerCnic || "",
        transferredName: prev.transferredName || j.ownerName || "",
        transferFromName: prev.transferFromName || j.ownerName || "",
        transferLetterDate: prev.transferLetterDate || new Date().toLocaleDateString(),
        allotmentOrderDate: prev.allotmentOrderDate || (j.poDate ? new Date(j.poDate).toLocaleDateString() : ""),
        allotmentOrderNo: prev.allotmentOrderNo || j.poNo || "",
        duesClearDate: prev.duesClearDate || new Date().toLocaleDateString(),
      }));
      setSuggestions([]);
    } catch (e: any) {
      setErr(e?.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePlotBlur = () => {
    const q = plot.trim();
    if (!q) return;
    if (suggestions.length === 1) {
      fetchNoc(suggestions[0].plotNo);
      return;
    }
    const exact = suggestions.find((s) => s.plotNo.toLowerCase() === q.toLowerCase());
    if (exact) fetchNoc(exact.plotNo);
  };


  useEffect(() => {
    setErr(null);
    clearGeneratedState();
    setFields((prev) => ({
      ...defaultFields,
      applicantName: prev.applicantName,
      relationName: prev.relationName,
      relationType: prev.relationType,
      plotMeasure: prev.plotMeasure,
      transferredName: template === "building" ? (prev.transferredName || prev.applicantName) : "",
      duesClearDate: template === "noDues" ? (prev.duesClearDate || new Date().toLocaleDateString()) : "",
      remarks: template === "building" ? (prev.remarks || "Vacant") : defaultFields.remarks,
      transferFromName: template === "transfer" ? (prev.transferFromName || prev.applicantName) : "",
      transferFromRelationType: template === "transfer" ? prev.transferFromRelationType : "S/O",
      transferFromRelationName: template === "transfer" ? prev.transferFromRelationName : "",
      transferLetterDate: template === "transfer" ? (prev.transferLetterDate || new Date().toLocaleDateString()) : "",
      allotmentOrderNo: template === "transfer" ? prev.allotmentOrderNo : "",
      allotmentOrderDate: template === "transfer" ? prev.allotmentOrderDate : "",
      recipientAddress: template === "transfer" ? prev.recipientAddress : "",
    }));
  }, [template]);

  const validateRequired = () => {
    for (const key of requiredFields) {
      const val = String(fields[key] || "").trim();
      if (!val) {
        const labelMap: Record<string, string> = {
          applicantName: "Applicant / Owner Name",
          relationType: "Relation Type",
          relationName: "Relation Name",
          plotMeasure: "Plot Measure",
          cnic: "CNIC",
          ownerType: "Owner Type",
          duesClearDate: "Dues Cleared Up To",
          buildingType: "Building Type",
          transferredName: "Transferred Name",
          remarks: "Remarks",
          transferFromName: "Current Plot Holder Name",
          transferFromRelationType: "Current Holder Relation Type",
          transferFromRelationName: "Current Holder Relation Name",
          transferLetterDate: "Transfer Application / Letter Date",
          allotmentOrderNo: "Allotment Order No.",
          allotmentOrderDate: "Allotment Order Date",
          recipientAddress: "Recipient Address",
        };
        setErr(`${labelMap[key] || key} is required.`);
        return false;
      }
    }
    return true;
  };

  const generateNoc = async () => {
    if (!data) return setErr("Select a plot from records first.");
    if (!data.canIssue) return setErr("Cannot generate document. Outstanding dues exist.");
    if (!validateRequired()) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API_BASE}/api/noc/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plotNo: data.plotNo,
          nocType: template,
          applicantName: fields.applicantName || data.ownerName,
          relationType: fields.relationType,
          relationName: fields.relationName,
          ownerType: fields.ownerType,
          plotMeasureSqYds: fields.plotMeasure,
          cnic: fields.cnic,
          duesClearedUpTo: fields.duesClearDate || null,
          buildingType: fields.buildingType,
          transferredName: fields.transferredName,
          remarks: JSON.stringify({
            remarks: fields.remarks,
            transferFromName: fields.transferFromName,
            transferFromRelationType: fields.transferFromRelationType,
            transferFromRelationName: fields.transferFromRelationName,
            transferLetterDate: fields.transferLetterDate,
            allotmentOrderNo: fields.allotmentOrderNo,
            allotmentOrderDate: fields.allotmentOrderDate,
            recipientAddress: fields.recipientAddress,
          }),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.isSuccess) throw new Error(json?.message || "Failed to save generated document");
      const saved = json.result || {};
      setNocId(saved.nocNumber || saved.noc_number || `DOC-${Date.now()}`);
      setSavedQrImage(saved.qrImage || saved.qr_image || "");
      setGenerated(true);
    } catch (e: any) {
      setGenerated(false);
      setErr(e?.message || "Failed to save generated document");
    } finally {
      setLoading(false);
    }
  };

  const printDoc = () => {
    if (typeof window !== "undefined") window.print();
  };

  const rendered = useMemo(() => {
    if (!data) return "";
    const owner = sanitizeLine(fields.applicantName || data.ownerName);
    const relation = sanitizeLine(fields.relationName);
    const relType = fields.relationType;
    const measure = sanitizeLine(fields.plotMeasure);
    const plotNo = sanitizeLine(data.plotNo);
    const clearDate = sanitizeLine(fields.duesClearDate);
    const cnic = sanitizeLine(fields.cnic);
    const ownerType = sanitizeLine(fields.ownerType);
    const buildingType = sanitizeLine(fields.buildingType);
    const transferredName = sanitizeLine(fields.transferredName || owner);
    const remarks = sanitizeLine(fields.remarks || "Vacant");
    const transferFromName = sanitizeLine(fields.transferFromName);
    const transferFromRelation = sanitizeLine(fields.transferFromRelationName);
    const transferFromRelType = fields.transferFromRelationType;
    const transferLetterDate = sanitizeLine(fields.transferLetterDate);
    const allotmentOrderNo = sanitizeLine(fields.allotmentOrderNo);
    const allotmentOrderDate = sanitizeLine(fields.allotmentOrderDate);
    const recipientAddress = sanitizeLine(fields.recipientAddress);

    switch (template) {
      case "sale":
        return {
          body: `This is to certify that Plot # ${plotNo} Measuring ${measure} Sq yds Situated at ${societyLine1} ${societyLine2} standing on the name of ${owner} ${relType} ${relation} Owner of Plot # ${plotNo} Measuring ${measure} Sq yds Situated at ${societyLine1} ${societyLine2} in this connection society does not have any objection if the owner/transferee sell of the plot.`,
        };
      case "water":
        return {
          body: `This is to certify that Plot No. ${plotNo}, Measuring ${measure} Sq. Yds. Situated at ${societyLine1} ${societyLine2} standing on the name of ${owner} ${relType} ${relation}, holding CNIC # ${cnic} in the connection society does not have any objection to installed water connection of said plot.`,
        };
      case "gas":
        return {
          preface: [
            "To",
            "The Deputy General Manager (Sales),",
            "Commercial Division,",
            "Sui Southern Gas Company,",
            "ST-4/B-14 Gulshan-e-Iqbal,",
            "Karachi.",
          ],
          subject: `NOC FOR SUPPLY OF GAS CONNECTION ON THE PLOT ${plotNo} MEASURING ${measure} SQ. YARDS.`,
          body: `This is certified that the Member/ Applicant has paid all the dues of the society and that the plot for which the connection has been applied for is on lawful possession of the applicant. Therefore, there is no objection if the 1st Gas Line / one time Connection is provided to the applicant ${owner} ${relType}, ${relation}, who is the ${ownerType} of the aforesaid plot.`,
        };
      case "electricity":
        return {
          preface: ["To", "The Manager", "K-Electric", "Qayyumabad, Karachi."],
          subject: `NOC FOR SUPPLY OF ELECTRICITY CONNECTION ON THE PLOT ${plotNo} MEASURING ${measure} SQ. YARDS.`,
          body: `This is certified that the Member/ Applicant has paid all the dues of the society and that the plot for which the connection has been applied for is on lawful possession of the applicant. Therefore, there is no objection if the 1st Electricity connection is provided to the applicant ${owner} ${relType}, ${relation}, who is the ${ownerType} of the aforesaid plot.`,
        };
      case "building":
        return {
          preface: ["To", "The Deputy Director", "Single Window Facility", "SBCA."],
          subject: `forwarded for approval of building plan for Plot ${plotNo} measuring ${measure} Sq. yds Korangi Karachi.`,
          table: [
            ["Plot No.", plotNo],
            ["Area of Plot (Sq. yards)", measure],
            ["Status of Plot", "Cleared"],
            ["Society / Area", `${societyLine1} ${societyLine2}`],
            ["Building type", buildingType],
            ["Transferred Name", transferredName],
            [relType, relation],
          ],
          body: `Who has paid upto date dues of plot in question, thus nothing of outstanding against the said property and the subject plot exists in the layout plan / revised layout plan.`,
        };
      case "verification":
        return {
          body: `This is to certify that Plot # ${plotNo} Measuring ${measure} Sq yds Situated at ${societyLine1} ${societyLine2} standing on the name of ${owner} ${relType} ${relation}.`,
        };
      case "construction":
        return {
          body: `This is to certify that Plot # ${plotNo} Measuring ${measure} Sq yds Situated at ${societyLine1} ${societyLine2} standing on the name of ${owner} ${relType} ${relation} Owner of Plot # ${plotNo} Measuring ${measure} Sq yds Situated at ${societyLine1} ${societyLine2} in this connection society does not have any objection if the owner/transferee construction of the plot.`,
        };
      case "transfer":
        return {
          preface: ["To,", `${owner}`, `${relType}, ${relation}`, `R/o, ${recipientAddress}`],
          subject: `TRANSFER OF COMMERCIAL PLOT NO. ${plotNo} MEASURING ${measure} SQ. YARDS IN FAVOUR OF ${owner} ${relType} ${relation}`,
          body: `${transferFromName} ${transferFromRelType}, ${transferFromRelation}, is the plot holder of the above plot vide letter dated: ${transferLetterDate}, has filed application for transfer his plot to your name along with your membership and relative share in your favor. ${transferFromName} ${transferFromRelType}, ${transferFromRelation} is ready to surrender his membership and relative share in your favor. In view of the documents of above subject plot, the same is hereby transfer in your favor in order to series of transfer mentioned on the back page of allotment order issued by the society on ${allotmentOrderDate}. The Original Allotment order No. ${allotmentOrderNo} dated: ${allotmentOrderDate} duly endorsed in your name is enclosed for your record. If any litigation/court case emerges pertaining to this plot/house/property, the transfer shall stand cancelled spontaneously.`,
        };
      case "noDues":
      default:
        return {
          body: `This is to certify that Plot # ${plotNo} Measuring ${measure} Sq yds Situated at ${societyLine1} ${societyLine2} standing on the name of ${owner} ${relType} ${relation}, he / she clears all his / her dues of Society up to ${clearDate}.`,
        };
    }
  }, [data, fields, template]);

  const qrText = useMemo(() => {
    if (!generated || !data) return "";
    return JSON.stringify({
      nocId,
      type: templates[template],
      plotNo: data.plotNo,
      owner: fields.applicantName || data.ownerName,
      issuedOn: new Date().toLocaleDateString(),
      authority: `${signName}, ${signTitle}`,
      society: signOrg,
    });
  }, [generated, nocId, data, template, fields.applicantName]);

  const fieldNode = (key: keyof NocFields) => {
    switch (key) {
      case "applicantName":
        return <div className="field" key={key}><label className="lbl">Applicant / Owner Name</label><input className="inp" value={fields.applicantName} onChange={(e) => setFieldValue("applicantName", e.target.value)} /></div>;
      case "relationType":
        return <div className="field" key={key}><label className="lbl">Relation Type</label><select className="inp" value={fields.relationType} onChange={(e) => setFieldValue("relationType", e.target.value as RelationType)}><option value="S/O">S/O</option><option value="W/O">W/O</option><option value="D/O">D/O</option></select></div>;
      case "relationName":
        return <div className="field" key={key}><label className="lbl">Relation Name</label><input className="inp" value={fields.relationName} onChange={(e) => setFieldValue("relationName", e.target.value)} /></div>;
      case "plotMeasure":
        return <div className="field" key={key}><label className="lbl">Plot Measure (Sq yds)</label><input className="inp" value={fields.plotMeasure} onChange={(e) => setFieldValue("plotMeasure", e.target.value)} /></div>;
      case "cnic":
        return <div className="field" key={key}><label className="lbl">CNIC</label><input className="inp" value={fields.cnic} onChange={(e) => setFieldValue("cnic", e.target.value)} /></div>;
      case "ownerType":
        return <div className="field" key={key}><label className="lbl">Owner Type</label><select className="inp" value={fields.ownerType} onChange={(e) => setFieldValue("ownerType", e.target.value as OwnerType)}><option value="Owner">Owner</option><option value="Allottee">Allottee</option><option value="Transferee">Transferee</option><option value="Applicant">Applicant</option></select></div>;
      case "duesClearDate":
        return <div className="field" key={key}><label className="lbl">Dues Cleared Up To</label><input className="inp" value={fields.duesClearDate} onChange={(e) => setFieldValue("duesClearDate", e.target.value)} placeholder="e.g. March 2026" /></div>;
      case "buildingType":
        return <div className="field" key={key}><label className="lbl">Building Type</label><input className="inp" value={fields.buildingType} onChange={(e) => setFieldValue("buildingType", e.target.value)} /></div>;
      case "transferredName":
        return <div className="field" key={key}><label className="lbl">Transferred Name</label><input className="inp" value={fields.transferredName} onChange={(e) => setFieldValue("transferredName", e.target.value)} /></div>;
      case "remarks":
        return <div className="field" key={key}><label className="lbl">Remarks</label><input className="inp" value={fields.remarks} onChange={(e) => setFieldValue("remarks", e.target.value)} /></div>;
      case "transferFromName":
        return <div className="field" key={key}><label className="lbl">Current Plot Holder Name</label><input className="inp" value={fields.transferFromName} onChange={(e) => setFieldValue("transferFromName", e.target.value)} /></div>;
      case "transferFromRelationType":
        return <div className="field" key={key}><label className="lbl">Current Holder Relation Type</label><select className="inp" value={fields.transferFromRelationType} onChange={(e) => setFieldValue("transferFromRelationType", e.target.value as RelationType)}><option value="S/O">S/O</option><option value="W/O">W/O</option><option value="D/O">D/O</option></select></div>;
      case "transferFromRelationName":
        return <div className="field" key={key}><label className="lbl">Current Holder Relation Name</label><input className="inp" value={fields.transferFromRelationName} onChange={(e) => setFieldValue("transferFromRelationName", e.target.value)} /></div>;
      case "transferLetterDate":
        return <div className="field" key={key}><label className="lbl">Transfer Application / Letter Date</label><input className="inp" value={fields.transferLetterDate} onChange={(e) => setFieldValue("transferLetterDate", e.target.value)} /></div>;
      case "allotmentOrderNo":
        return <div className="field" key={key}><label className="lbl">Allotment Order No.</label><input className="inp" value={fields.allotmentOrderNo} onChange={(e) => setFieldValue("allotmentOrderNo", e.target.value)} /></div>;
      case "allotmentOrderDate":
        return <div className="field" key={key}><label className="lbl">Allotment Order Date</label><input className="inp" value={fields.allotmentOrderDate} onChange={(e) => setFieldValue("allotmentOrderDate", e.target.value)} /></div>;
      case "recipientAddress":
        return <div className="field span2" key={key}><label className="lbl">Recipient Address</label><textarea className="inp ta" value={fields.recipientAddress} onChange={(e) => setFieldValue("recipientAddress", e.target.value)} /></div>;
      default:
        return null;
    }
  };

  return (
    <div className="wrap wideWrap">
      <div className="pageGrid">
        <div className="card no-print wideCard">
          <h1 className="h1">Generate NOC</h1>
          <p className="p">Select the plot from records. Required fields change automatically when you change NOC type.</p>

          <div className="searchRow nocSearchRow">
            <div className="field growField nocSearchField">
              <label className="lbl">Plot No.</label>
              <input
                className="inp"
                value={plot}
                onChange={(e) => { setPlot(e.target.value); setErr(null); clearGeneratedState(); }}
                onBlur={handlePlotBlur}
                placeholder="Type plot no. to search from records"
                onKeyDown={(e) => {
                  if (e.key === "Enter") fetchNoc();
                }}
              />
            </div>
            <div className="field">
              <label className="lbl">NOC Type</label>
              <select className="inp" value={template} onChange={(e) => setTemplate(e.target.value as TemplateKey)}>
                {Object.entries(templates).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </div>
          </div>

          {suggestions.length > 0 && !data && (
            <div className="quickHints no-print">
              {suggestions.map((item) => (
                <button key={item.plotNo} className="hintChip" onClick={() => fetchNoc(item.plotNo)}>{item.plotNo} · {item.ownerName || "Owner"}</button>
              ))}
            </div>
          )}

          {err && <div className="alert error">{err}</div>}

          <div className="formGrid3">
            {requiredFields.map(fieldNode)}
          </div>

          <div className="printActions" style={{ marginTop: 18, gap: 12 }}>
            <button className="btn primary" onClick={generateNoc} disabled={!data || loading}>Generate / Save Document</button>
            <button className="btn" onClick={printDoc} disabled={!generated}>Print / Save PDF</button>
          </div>
        </div>

        <section className="card wideCard no-print adminNocManagement">
          <div className="adminNocHeader">
            <div>
              <h2 className="h2">Resident NOC Management</h2>
              <p className="p">View resident requests and all issued NOCs. Search by plot number, NOC number, type, or status.</p>
            </div>
            <button className="btn" onClick={loadNocLists} disabled={nocListsLoading}>
              {nocListsLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          <div className="nocAdminSearch">
            <span className="nocSearchIcon">⌕</span>
            <input
              className="inp"
              value={nocListSearch}
              onChange={(e) => setNocListSearch(e.target.value)}
              placeholder="Search by plot no., NOC no., request type, or status"
            />
            {nocListSearch ? <button className="nocSearchClear" onClick={() => setNocListSearch('')}>Clear</button> : null}
          </div>

          {nocListsError ? <div className="alert error">{nocListsError}</div> : null}
          {nocActionMessage ? <div className="alert success">{nocActionMessage}</div> : null}

          <div className="nocAdminGrid">
            <div className="nocAdminPanel">
              <div className="nocAdminPanelHead">
                <div><h3>Resident Requests</h3><p>Requests submitted from resident accounts. Approve, decline, view details, or chat with the resident.</p></div>
                <span className="nocCountPill">{filteredRequests.length}</span>
              </div>
              <div className="chatList nocRequestList">
                {filteredRequests.map((item) => {
                  const key = String(item.id);
                  const status = String(item.status || 'PENDING').toUpperCase();
                  const isClosed = status === 'APPROVED' || status === 'DECLINED' || status === 'REJECTED';
                  const expanded = expandedRequestId === item.id;
                  const draft = nocDrafts[key] || { message: '', imageUrls: [] };
                  const busy = nocActionBusyId === item.id;
                  return (
                    <div key={item.id} className="chatCard nocRequestCard">
                      <div className="chatHeader">
                        <div>
                          <h3 className="h2" style={{ marginBottom: 6 }}>{displayNocType(item.request_type || item.requestType)} · Plot {item.plot_no || item.plotNo || '-'}</h3>
                          <div className="smallMuted">{item.notes || 'No additional notes'} · Updated {displayDate(item.updated_at || item.updatedAt || item.created_at || item.createdAt)}</div>
                        </div>
                        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                          <span className={`badge status ${status === 'APPROVED' ? 'paid' : status === 'REVIEWING' ? 'partially_paid' : status === 'DECLINED' || status === 'REJECTED' ? 'unpaid' : 'unpaid'}`}>{status}</span>
                          <button className="btn small" onClick={() => toggleRequestView(item.id)}>{expanded ? 'Hide' : 'View'}</button>
                          <button className="btn small primary" disabled={busy || status === 'APPROVED'} onClick={() => approveAndIssueNoc(item)}>{busy ? 'Approving…' : 'Approve'}</button>
                          <button className="btn small danger" disabled={busy || status === 'DECLINED'} onClick={() => updateNocRequestStatus(item, 'DECLINED')}>Decline</button>
                        </div>
                      </div>

                      {expanded ? (
                        <>
                          <div className="chatThread">
                            {(item.updates || []).map((u, idx) => (
                              <div key={idx} className={`bubble ${u.sender || 'system'}`}>
                                <div>{u.message}</div>
                                {(u.imageUrls || []).length ? <div className="thumbRow">{(u.imageUrls || []).map((src, i) => <ImagePreview key={i} src={src} className="thumbImg" />)}</div> : null}
                                <small className="bubbleTime">{u.createdAt ? new Date(u.createdAt).toLocaleString() : ''}</small>
                              </div>
                            ))}
                            {!(item.updates || []).length ? <div className="mutedCell">No messages yet.</div> : null}
                          </div>

                          {!isClosed ? (
                            <div className="chatCompose">
                              <textarea
                                className="inp ta"
                                placeholder="Write a message for the resident..."
                                value={draft.message}
                                onChange={(e) => setNocDrafts((prev) => ({ ...prev, [key]: { message: e.target.value, imageUrls: prev[key]?.imageUrls || [] } }))}
                              />
                              <input
                                className="inp"
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={async (e) => {
                                  const images = await readFiles(e.target.files);
                                  setNocDrafts((prev) => ({ ...prev, [key]: { message: prev[key]?.message || '', imageUrls: [...(prev[key]?.imageUrls || []), ...images] } }));
                                  e.currentTarget.value = '';
                                }}
                              />
                              {(draft.imageUrls || []).length ? <div className="thumbRow">{draft.imageUrls.map((src, idx) => <ImagePreview key={idx} src={src} className="thumbImg" />)}</div> : null}
                              <div className="row">
                                <button className="btn primary" disabled={busy} onClick={() => sendNocRequestMessage(item)}>Send Reply</button>
                              </div>
                            </div>
                          ) : (
                            <div className="smallMuted" style={{ marginTop: 10 }}>This request is {status.toLowerCase()} and no longer accepts new messages.</div>
                          )}
                        </>
                      ) : null}
                    </div>
                  );
                })}
                {!filteredRequests.length ? <div className="mutedCell">No resident NOC requests found.</div> : null}
              </div>
            </div>

            <div className="nocAdminPanel">
              <div className="nocAdminPanelHead">
                <div><h3>Issued NOCs</h3><p>All documents generated by the administration.</p></div>
                <span className="nocCountPill">{filteredIssuedNocs.length}</span>
              </div>
              <div className="tableWrap">
                <table className="tbl nocAdminTable">
                  <thead><tr><th>Plot No.</th><th>NOC No.</th><th>Type</th><th>Status</th><th>Issued At</th></tr></thead>
                  <tbody>
                    {filteredIssuedNocs.map((item) => (
                      <tr key={item.id || item.noc_number || item.nocNumber}>
                        <td><strong>{item.plot_no || item.plotNo || '-'}</strong></td>
                        <td className="nocNumberCell">{item.noc_number || item.nocNumber || '-'}</td>
                        <td>{displayNocType(item.noc_type || item.nocType)}</td>
                        <td><span className={`badge status ${String(item.status).toLowerCase() === 'active' ? 'paid' : 'unpaid'}`}>{item.status || 'ACTIVE'}</span></td>
                        <td>{displayDate(item.issued_at || item.issuedAt)}</td>
                      </tr>
                    ))}
                    {!filteredIssuedNocs.length ? <tr><td colSpan={5} className="mutedCell">No issued NOCs found.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {data && generated && (
          <div className="doc nocDoc">
            <div className="nocTop">
              <div>
                <h2 className="nocOrg">{societyLine1}</h2>
                <div className="nocArea">{societyLine2}</div>
                <div className="nocTitle">{templates[template]}</div>
              </div>
              {savedQrImage || qrText ? <img src={savedQrImage || qrImage(qrText)} alt="Document QR" className="nocQr" /> : null}
            </div>

            {"preface" in (rendered as any) && (rendered as any).preface ? (
              <div className="body" style={{ lineHeight: 1.8, marginTop: 20 }}>
                <p>{(rendered as any).preface.map((line: string, idx: number) => <span key={idx}>{line}<br /></span>)}</p>
                {(rendered as any).subject ? <p><b>Subject:</b> {(rendered as any).subject}</p> : null}
              </div>
            ) : null}

            <div className="body" style={{ marginTop: 18, lineHeight: 2.0 }}>
              {template === "building" && "table" in (rendered as any) && (rendered as any).table ? (
                <table className="nocMiniTable"><tbody>{(rendered as any).table.map(([k, v]: [string, string], idx: number) => <tr key={idx}><td>{k}</td><td>{v}</td></tr>)}</tbody></table>
              ) : null}
              <p>{(rendered as any).body}</p>
            </div>

            <div className="nocSignOnly">
              <div className="line" />
              <div className="signNameOnly">{signName}</div>
              <div>{signTitle}</div>
              <div>{signOrg}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
