/**
 * GOOGLE SHEETS BACKEND FOR QUOTATION TRACKER (V17)
 * Includes safe migration for the Specification Value column,
 * plus Brand, Color Specification, Fatch Past Media, and Team Member credentials.
 */

const MANAGED_SHEET_NAMES = [
  'Clients',
  'ProjectMasters',
  'ProductCategoryMasters',
  'ProductMasters',
  'MediaMasters',
  'TeamMembers',
  'Brand',
  'Specification',
  'Color Specification',
  'TermsMaster',
  'Quotations',
  'Discount',
  'OrganizationSettings'
];

const HEADER_CHECK_INTERVAL_MS = 10 * 60 * 1000;
const HEADER_CHECK_PROPERTY_KEY = 'quotation_tracker_last_header_check_at';
const DATA_CACHE_TTL_SECONDS = 45;
const CACHE_KEY_PREFIX = 'quotation_tracker_payload_v2_';
const MAX_CACHE_BYTES = 90 * 1024;

function sendCorsResponse(result) {
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function getDataCache() {
  return CacheService.getScriptCache();
}

function getDataCacheKey(view) {
  return CACHE_KEY_PREFIX + (view || 'full');
}

function clearDataCache() {
  getDataCache().removeAll(['full', 'bootstrap', 'auth'].map(getDataCacheKey));
}

function getRequestView(e) {
  const requested = e && e.parameter && e.parameter.view ? String(e.parameter.view).toLowerCase() : 'full';
  if (requested === 'auth' || requested === 'bootstrap') return requested;
  return 'full';
}

function getPayloadSizeBytes(text) {
  return Utilities.newBlob(text || '').getBytes().length;
}

function shouldUseCacheForView(view) {
  return view === 'auth' || view === 'bootstrap';
}

function tryCachePayload(view, serialized) {
  if (!shouldUseCacheForView(view)) return false;
  try {
    if (getPayloadSizeBytes(serialized) <= MAX_CACHE_BYTES) {
      getDataCache().put(getDataCacheKey(view), serialized, DATA_CACHE_TTL_SECONDS);
      return true;
    }
    Logger.log('Cache skipped for view "' + view + '" because payload is too large.');
  } catch (err) {
    Logger.log('Cache skipped for view "' + view + '": ' + err);
  }
  return false;
}

function toBootstrapQuotation(quotation) {
  if (!quotation || typeof quotation !== 'object') return quotation;
  const project = quotation.project && typeof quotation.project === 'object'
    ? {
        id: quotation.project.id || '',
        masterId: quotation.project.masterId || '',
        name: quotation.project.name || '',
        location: quotation.project.location || '',
        description: quotation.project.description || '',
        projectTotal: quotation.project.projectTotal || 0,
        products: Array.isArray(quotation.project.products)
          ? quotation.project.products.map(function(product) {
              return {
                id: product && product.id || '',
                masterId: product && product.masterId || '',
                name: product && product.name || '',
                description: product && product.description || '',
                photo: product && product.photo || '',
                productTotal: product && product.productTotal || 0,
                mediaItems: []
              };
            })
          : []
      }
    : quotation.project;

  return {
    ...quotation,
    project: project
  };
}

function buildResponsePayload(ss, view) {
  if (view === 'auth') {
    return {
      success: true,
      data: {
        teamMembers: getSheetDataAsJson(ss, 'TeamMembers')
      }
    };
  }

  if (view === 'bootstrap') {
    return {
      success: true,
      data: {
        clients: getSheetDataAsJson(ss, 'Clients'),
        projectMasters: getSheetDataAsJson(ss, 'ProjectMasters'),
        productCategoryMasters: getSheetDataAsJson(ss, 'ProductCategoryMasters'),
        productMasters: getSheetDataAsJson(ss, 'ProductMasters'),
        mediaMasters: getSheetDataAsJson(ss, 'MediaMasters'),
        teamMembers: getSheetDataAsJson(ss, 'TeamMembers'),
        brands: getSheetDataAsJson(ss, 'Brand'),
        specifications: getSheetDataAsJson(ss, 'Specification'),
        colorSpecifications: getSheetDataAsJson(ss, 'Color Specification'),
        termsMaster: getSheetDataAsJson(ss, 'TermsMaster'),
        quotations: getSheetDataAsJson(ss, 'Quotations').map(toBootstrapQuotation),
        discounts: getSheetDataAsJson(ss, 'Discount'),
        settings: getSheetDataAsJson(ss, 'OrganizationSettings')[0] || {}
      }
    };
  }

  return {
    success: true,
    data: {
      clients: getSheetDataAsJson(ss, 'Clients'),
      projectMasters: getSheetDataAsJson(ss, 'ProjectMasters'),
      productCategoryMasters: getSheetDataAsJson(ss, 'ProductCategoryMasters'),
      productMasters: getSheetDataAsJson(ss, 'ProductMasters'),
      mediaMasters: getSheetDataAsJson(ss, 'MediaMasters'),
      teamMembers: getSheetDataAsJson(ss, 'TeamMembers'),
      brands: getSheetDataAsJson(ss, 'Brand'),
      specifications: getSheetDataAsJson(ss, 'Specification'),
      colorSpecifications: getSheetDataAsJson(ss, 'Color Specification'),
      termsMaster: getSheetDataAsJson(ss, 'TermsMaster'),
      quotations: getSheetDataAsJson(ss, 'Quotations'),
      discounts: getSheetDataAsJson(ss, 'Discount'),
      settings: getSheetDataAsJson(ss, 'OrganizationSettings')[0] || {}
    }
  };
}

function doGet(e) {
  try {
    const view = getRequestView(e);
    const cache = getDataCache();

    if (shouldUseCacheForView(view)) {
      const cachedPayload = cache.get(getDataCacheKey(view));
      if (cachedPayload) {
        return ContentService.createTextOutput(cachedPayload)
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const responsePayload = buildResponsePayload(ss, view);
    const serialized = JSON.stringify(responsePayload);

    // Never allow cache size limits to break the API response.
    tryCachePayload(view, serialized);

    return ContentService.createTextOutput(serialized)
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return sendCorsResponse({ success: false, message: error.toString() });
  }
}

function onEdit(e) {
  try {
    const ss = e && e.source ? e.source : SpreadsheetApp.getActiveSpreadsheet();
    ensureAllHeaders(ss);
  } catch (error) {}
}

function onChange(e) {
  try {
    const ss = e && e.source ? e.source : SpreadsheetApp.getActiveSpreadsheet();
    ensureAllHeaders(ss);
  } catch (error) {}
}

function onAnySheetChange(e) {
  try {
    const ss = e && e.source ? e.source : SpreadsheetApp.getActiveSpreadsheet();
    ensureAllHeaders(ss);
  } catch (error) {}
}

function setupHeaderGuards() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureAllHeaders(ss);

  const triggers = ScriptApp.getProjectTriggers();
  const hasOnChange = triggers.some(function(t) {
    return t.getHandlerFunction() === 'onAnySheetChange';
  });

  if (!hasOnChange) {
    ScriptApp.newTrigger('onAnySheetChange')
      .forSpreadsheet(ss)
      .onChange()
      .create();
  }

  MANAGED_SHEET_NAMES.forEach(function(name) {
    const sheet = getOrCreateSheet(ss, name);
    const headerRange = sheet.getRange(1, 1, 1, Math.max(1, getDefaultHeaders(name).length));
    const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
    const alreadyProtected = protections.some(function(p) {
      try {
        const r = p.getRange();
        return r.getSheet().getName() === sheet.getName() && r.getRow() === 1 && r.getNumRows() === 1;
      } catch (err) {
        return false;
      }
    });

    if (!alreadyProtected) {
      const protection = headerRange.protect().setDescription('Auto-protected header row');
      protection.setWarningOnly(false);
    }
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  let lockAcquired = false;

  try {
    lock.waitLock(30000);
    lockAcquired = true;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureAllHeadersIfDue(ss);

    let payload;
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e && e.parameter && e.parameter.payload) {
      payload = JSON.parse(e.parameter.payload);
    } else {
      throw new Error('No data received in POST request');
    }

    const operation = payload.operation;
    const data = payload.data;
    const deletions = payload.deletions || {};

    if (operation === 'syncAll') {
      syncAllData(ss, data, deletions);
      clearDataCache();
      return sendCorsResponse({ success: true, message: 'Sync complete' });
    }

    return sendCorsResponse({ success: false, message: 'Unknown operation: ' + operation });
  } catch (error) {
    return sendCorsResponse({ success: false, message: error.toString() });
  } finally {
    if (lockAcquired) lock.releaseLock();
  }
}

function syncAllData(ss, data, deletions) {
  const updates = [
    { key: 'clients', name: 'Clients', data: data && Array.isArray(data.clients) ? data.clients : [] },
    { key: 'projectMasters', name: 'ProjectMasters', data: data && Array.isArray(data.projectMasters) ? data.projectMasters : [] },
    { key: 'productCategoryMasters', name: 'ProductCategoryMasters', data: data && Array.isArray(data.productCategoryMasters) ? data.productCategoryMasters : [] },
    { key: 'productMasters', name: 'ProductMasters', data: data && Array.isArray(data.productMasters) ? data.productMasters : [] },
    { key: 'mediaMasters', name: 'MediaMasters', data: data && Array.isArray(data.mediaMasters) ? data.mediaMasters : [] },
    { key: 'teamMembers', name: 'TeamMembers', data: data && Array.isArray(data.teamMembers) ? data.teamMembers : [] },
    { key: 'brands', name: 'Brand', data: data && Array.isArray(data.brands) ? data.brands : [] },
    { key: 'specifications', name: 'Specification', data: data && Array.isArray(data.specifications) ? data.specifications : [] },
    { key: 'colorSpecifications', name: 'Color Specification', data: data && Array.isArray(data.colorSpecifications) ? data.colorSpecifications : [] },
    { key: 'termsMaster', name: 'TermsMaster', data: data && Array.isArray(data.termsMaster) ? data.termsMaster : [] },
    { key: 'quotations', name: 'Quotations', data: data && Array.isArray(data.quotations) ? data.quotations : [] },
    { key: 'discounts', name: 'Discount', data: data && Array.isArray(data.discounts) ? data.discounts : [] }
  ];

  updates.forEach(function(item) {
    const deletedIds = deletions && Array.isArray(deletions[item.key]) ? deletions[item.key] : [];
    mergeTableById(ss, item.name, item.data, deletedIds);
  });

  mergeSingleSettings(ss, data && data.settings ? data.settings : null);
}

function ensureAllHeadersIfDue(ss, force) {
  const props = PropertiesService.getDocumentProperties();
  const lastRun = Number(props.getProperty(HEADER_CHECK_PROPERTY_KEY) || '0');
  const now = Date.now();
  if (!force && lastRun && (now - lastRun) < HEADER_CHECK_INTERVAL_MS) return;
  ensureAllHeaders(ss);
  props.setProperty(HEADER_CHECK_PROPERTY_KEY, String(now));
}

function ensureAllHeaders(ss) {
  MANAGED_SHEET_NAMES.forEach(function(name) {
    ensureSheetHeader(ss, name);
  });
}

function ensureSheetHeader(ss, sheetName) {
  const headers = getDefaultHeaders(sheetName);
  if (!headers || headers.length === 0) return;

  const sheet = getOrCreateSheet(ss, sheetName);
  migrateLegacySheetStructure(sheet, sheetName);
  ensureColumnCapacity(sheet, headers.length);

  const existing = sheet.getRange(1, 1, 1, headers.length).getValues()[0]
    .map(function(v) { return String(v || '').trim(); });

  const shouldRepair = headers.some(function(h, i) {
    return existing[i] !== h;
  });

  if (shouldRepair) {
    sheet.getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setFontWeight('bold')
      .setBackground('#f3f4f6');
  }

  sheet.setFrozenRows(1);
}

function migrateLegacySheetStructure(sheet, sheetName) {
  if (sheetName !== 'Specification' && sheetName !== 'Color Specification') return;

  const lastColumn = Math.max(sheet.getLastColumn(), 4);
  ensureColumnCapacity(sheet, lastColumn);

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
    .map(function(v) { return String(v || '').trim(); });

  if (sheetName === 'Specification') {
    const isLegacySpecificationLayout =
      headers[0] === 'id' &&
      headers[1] === 'specification' &&
      headers[2] === 'createdAt' &&
      headers[3] === 'updatedAt' &&
      headers.indexOf('Specification Value') === -1;

    if (isLegacySpecificationLayout) {
      sheet.insertColumnAfter(2);
      sheet.getRange(1, 3).setValue('Specification Value');
    }
  }

  if (sheetName === 'Color Specification') {
    const isLegacyColorSpecificationLayout =
      headers[0] === 'id' &&
      headers[1] === 'Color specification' &&
      headers[2] === 'createdAt' &&
      headers[3] === 'updatedAt' &&
      headers.indexOf('Specification Value') === -1;

    if (isLegacyColorSpecificationLayout) {
      sheet.insertColumnAfter(2);
      sheet.getRange(1, 3).setValue('Specification Value');
    }
  }
}

function ensureColumnCapacity(sheet, requiredColumns) {
  const maxColumns = sheet.getMaxColumns();
  if (maxColumns < requiredColumns) {
    sheet.insertColumnsAfter(maxColumns, requiredColumns - maxColumns);
  }
}

function parseFlexibleDate(v) {
  if (!v) return null;

  if (Object.prototype.toString.call(v) === '[object Date]') {
    return isNaN(v.getTime()) ? null : v;
  }

  if (typeof v === 'number') {
    const dNum = new Date(v);
    return isNaN(dNum.getTime()) ? null : dNum;
  }

  const s = String(v).trim();
  if (!s) return null;

  const direct = new Date(s);
  if (!isNaN(direct.getTime())) return direct;

  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return null;

  const day = Number(m[1]);
  const month = Number(m[2]) - 1;
  const year = Number(m[3]);
  const hour = Number(m[4] || 0);
  const minute = Number(m[5] || 0);
  const second = Number(m[6] || 0);
  const d = new Date(year, month, day, hour, minute, second);

  return isNaN(d.getTime()) ? null : d;
}

function toMillis(v) {
  const d = parseFlexibleDate(v);
  return d ? d.getTime() : 0;
}

function preferIncoming(existing, incoming) {
  const existingTs = toMillis(existing && existing.updatedAt);
  const incomingTs = toMillis(incoming && incoming.updatedAt);
  if (incomingTs === 0 && existingTs === 0) return true;
  return incomingTs >= existingTs;
}

function getRowId(row) {
  if (!row || typeof row !== 'object') return '';
  return String(row.id || row.Id || '').trim();
}

function normalizeForComparison(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeForComparison);
  }
  if (value && typeof value === 'object') {
    const normalized = {};
    Object.keys(value).sort().forEach(function(key) {
      normalized[key] = normalizeForComparison(value[key]);
    });
    return normalized;
  }
  if (value === undefined || value === null) return '';
  return value;
}

function toComparableJson(value) {
  return JSON.stringify(normalizeForComparison(value));
}

function haveRowsChanged(existingRows, nextRows) {
  if ((existingRows || []).length !== (nextRows || []).length) return true;

  const existingById = {};
  (existingRows || []).forEach(function(row) {
    const id = getRowId(row);
    existingById[id] = toComparableJson(row);
  });

  for (var i = 0; i < (nextRows || []).length; i += 1) {
    const row = nextRows[i];
    const id = getRowId(row);
    if (!id) return true;
    if (!(id in existingById)) return true;
    if (existingById[id] !== toComparableJson(row)) return true;
  }

  return false;
}

function mergeTableById(ss, name, incomingRows, deletedIds) {
  const existingRows = getSheetDataAsJson(ss, name);
  const deleteSet = {};

  (deletedIds || []).forEach(function(id) {
    if (id) deleteSet[String(id)] = true;
  });

  const map = {};
  existingRows.forEach(function(row) {
    const id = getRowId(row);
    if (!id) return;
    if (!deleteSet[id]) map[id] = row;
  });

  (incomingRows || []).forEach(function(row) {
    const id = getRowId(row);
    if (!id) return;
    if (deleteSet[id]) return;
    const existing = map[id];
    if (!existing || preferIncoming(existing, row)) {
      map[id] = row;
    }
  });

  const merged = Object.keys(map).map(function(id) {
    return map[id];
  });

  if (!haveRowsChanged(existingRows, merged)) return;
  writeTable(ss, name, merged);
}

function mergeSingleSettings(ss, incomingSettings) {
  const existing = getSheetDataAsJson(ss, 'OrganizationSettings')[0] || {};
  const next = (incomingSettings && Object.keys(incomingSettings).length > 0)
    ? incomingSettings
    : existing;
  const rows = next && Object.keys(next).length > 0 ? [next] : [];
  if (!haveRowsChanged(existing ? [existing] : [], rows)) return;
  writeTable(ss, 'OrganizationSettings', rows);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatDateForSheet(v, withTime) {
  const d = parseFlexibleDate(v);
  if (!d) return '';

  const day = pad2(d.getDate());
  const month = pad2(d.getMonth() + 1);
  const year = d.getFullYear();

  if (!withTime) return day + '/' + month + '/' + year;

  const h = pad2(d.getHours());
  const m = pad2(d.getMinutes());
  const s = pad2(d.getSeconds());
  return day + '/' + month + '/' + year + ' ' + h + ':' + m + ':' + s;
}

function isDateTimeField(field) {
  return field === 'createdAt' || field === 'updatedAt';
}

function isDateOnlyField(field) {
  return field === 'lastFollowUpDate' || field === 'nextFollowUpDate' || /Date$/.test(field);
}

function writeTable(ss, name, rows) {
  const sheet = getOrCreateSheet(ss, name);
  const defaultHeaders = getDefaultHeaders(name);
  const dataHeaders = rows && rows.length > 0 ? Object.keys(rows[0]) : [];
  const headers = defaultHeaders.length > 0 ? defaultHeaders : dataHeaders;

  if (!headers || headers.length === 0) return;

  ensureColumnCapacity(sheet, headers.length);

  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), headers.length);

  if (lastRow > 1 && lastCol > 0) {
    sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
  }

  if (lastCol > headers.length) {
    sheet.getRange(1, headers.length + 1, 1, lastCol - headers.length).clearContent();
  }

  sheet.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight('bold')
    .setBackground('#f3f4f6');

  if (!rows || rows.length === 0) return;

  const dataValues = rows.map(function(row) {
    return headers.map(function(h) {
      let val = row[h];

      if (name === 'Specification' && h === 'Specification Value' && (val === undefined || val === null || val === '')) {
        val = row.specificationValue;
      }
      if (name === 'Specification' && h === 'Order Number' && (val === undefined || val === null || val === '')) {
        val = row.orderNumber;
      }

      if (name === 'Color Specification') {
        if (h === 'Color specification' && (val === undefined || val === null || val === '')) {
          val = row.colorSpecification;
        }
        if (h === 'Specification Value' && (val === undefined || val === null || val === '')) {
          val = row.specificationValue;
        }
        if (h === 'Order Number' && (val === undefined || val === null || val === '')) {
          val = row.orderNumber;
        }
      }

      if (name === 'Brand') {
        if (h === 'Id' && (val === undefined || val === null || val === '')) {
          val = row.id;
        }
        if (h === 'Brand' && (val === undefined || val === null || val === '')) {
          val = row.brand;
        }
        if (h === 'Order Number' && (val === undefined || val === null || val === '')) {
          val = row.orderNumber;
        }
      }

      if (name === 'TeamMembers') {
        if (h === 'Id' && (val === undefined || val === null || val === '')) {
          val = row.teamId;
        }
        if (h === 'Password' && (val === undefined || val === null || val === '')) {
          val = row.password;
        }
      }

      if (name === 'OrganizationSettings' && h === 'Fatch Past Media' && (val === undefined || val === null || val === '')) {
        val = row.fatchPastMedia;
      }

      let finalVal = '';
      if (typeof val === 'object' && val !== null) {
        finalVal = JSON.stringify(val);
      } else if (isDateTimeField(h)) {
        finalVal = formatDateForSheet(val, true);
      } else if (isDateOnlyField(h)) {
        finalVal = formatDateForSheet(val, false);
      } else {
        finalVal = (val === undefined || val === null) ? '' : String(val);
      }
      return finalVal.substring(0, 50000);
    });
  });

  sheet.getRange(2, 1, dataValues.length, headers.length).setValues(dataValues);
}

function getSheetDataAsJson(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) return [];

  const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();

  const headers = values[0];
  return values.slice(1).map(function(row) {
    const obj = {};
    headers.forEach(function(h, i) {
      let val = row[i];
      if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
        try {
          val = JSON.parse(val);
        } catch (e) {}
      }
      obj[h] = val;
    });
    return obj;
  });
}

function getOrCreateSheet(ss, name) {
  let sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
    const defaultHeaders = getDefaultHeaders(name);

    if (defaultHeaders.length > 0) {
      ensureColumnCapacity(sheet, defaultHeaders.length);
      sheet.getRange(1, 1, 1, defaultHeaders.length)
        .setValues([defaultHeaders])
        .setFontWeight('bold')
        .setBackground('#f3f4f6');
    }
  }

  return sheet;
}

function getDefaultHeaders(sheetName) {
  switch (sheetName) {
    case 'Clients':
      return ['id', 'name', 'contactPerson', 'contactEmail', 'contactMobile', 'gstNumber', 'address', 'remarks', 'createdAt', 'updatedAt'];

    case 'ProjectMasters':
      return ['id', 'clientId', 'name', 'location', 'description', 'projectManagerId', 'createdAt', 'updatedAt'];

    case 'ProductCategoryMasters':
      return ['id', 'name', 'description', 'createdAt', 'updatedAt'];

    case 'ProductMasters':
      return ['id', 'productCategoryId', 'name', 'description', 'createdAt', 'updatedAt'];

    case 'MediaMasters':
      return ['id', 'name', 'unit', 'defaultRate', 'description', 'colorOptions', 'productCategoryId', 'createdAt', 'updatedAt'];

    case 'TeamMembers':
      return ['id', 'name', 'Id', 'Password', 'createdAt', 'updatedAt'];

    case 'Brand':
      return ['Id', 'Brand', 'Order Number'];

    case 'Specification':
      return ['id', 'specification', 'Specification Value', 'createdAt', 'updatedAt', 'Order Number'];

    case 'Color Specification':
      return ['id', 'Color specification', 'Specification Value', 'createdAt', 'updatedAt', 'Order Number'];

    case 'TermsMaster':
      return ['id', 'title', 'content', 'createdAt', 'updatedAt'];

    case 'Discount':
      return ['id', 'discount', 'createdAt', 'updatedAt'];

    case 'OrganizationSettings':
      return ['name', 'address', 'gstNumber', 'logo', 'googleSheetUrl', 'Fatch Past Media', 'createdAt', 'updatedAt'];

    case 'Quotations':
      return [
        'id', 'quotationNo', 'clientId', 'project', 'status', 'terms', 'createdAt', 'updatedAt',
        'checkerName', 'senderName', 'followUpPersonName', 'lastFollowUpDate', 'lastFollowUpRemark',
        'nextFollowUpDate', 'packing', 'forwarding', 'transportation', 'installation', 'wiring',
        'scaffolding', 'hydraCrane', 'miscExpenses', 'gstRate', 'gstAmount'
      ];

    default:
      return [];
  }
}
