# API Reference — Namecard Station

> **Base URL:** `http://<computer-lan-ip>:3000`
> **Version:** 0.1.0 (MVP)

---

## Overview

All endpoints return JSON. Image uploads use `multipart/form-data`. The API is designed for single-user LAN usage with no authentication in MVP.

### Common Response Envelope

```json
{
  "ok": true,
  "data": { ... },
  "error": null
}
```

On error:

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "CARD_NOT_FOUND",
    "message": "Card with id 'xyz' not found"
  }
}
```

---

## Health

### `GET /health`

Check if the server is running.

**Response `200`**

```json
{
  "status": "ok",
  "version": "0.1.0",
  "uptime": 12345
}
```

---

## Cards

### `POST /api/cards/start`

Start a new card capture session. Creates a card folder and returns a unique `cardId`.

**Response `201`**

```json
{
  "ok": true,
  "data": {
    "cardId": "2026-05-24_230501_ab12",
    "folder": "data/cards/2026-05-24_230501_ab12",
    "created_at": "2026-05-24T23:05:01+08:00"
  }
}
```

**Server behavior:**
1. Generates unique `cardId` (format: `YYYY-MM-DD_HHmmss_xxxx`)
2. Creates folder `data/cards/{cardId}/`
3. Creates `metadata.json` with initial values
4. Creates `status.json` with all fields set to `pending`
5. Creates `contact.md` template

**Errors**

| Code | Status | Description |
|------|--------|-------------|
| `FOLDER_CREATE_FAILED` | 500 | Could not create card directory |

---

### `POST /api/cards/:cardId/front`

Upload the front image of a business card.

**Request**

```
Content-Type: multipart/form-data
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | Front image (JPEG, PNG, or WebP) |
| `original` | File | No | Uncropped original image |

**Response `200`**

```json
{
  "ok": true,
  "data": {
    "cardId": "2026-05-24_230501_ab12",
    "front": "front.jpg",
    "front_original": "front.original.jpg",
    "size": 245760,
    "uploaded_at": "2026-05-24T23:05:15+08:00"
  }
}
```

**Server behavior:**
1. Validates `cardId` exists
2. Accepts `image/jpeg`, `image/png`, `image/webp` (max 20MB)
3. Saves as `front.jpg` in card folder
4. Saves `front.original.jpg` if provided
5. Updates `status.json` → `front: "done"`, `capture: "partial"`
6. Updates `metadata.json` → `updated_at`, `files.front`, `files.front_original`

**Errors**

| Code | Status | Description |
|------|--------|-------------|
| `CARD_NOT_FOUND` | 404 | Invalid `cardId` |
| `FILE_MISSING` | 400 | No file in request |
| `FILE_TOO_LARGE` | 413 | File exceeds 20MB limit |
| `UNSUPPORTED_TYPE` | 415 | File is not JPEG, PNG, or WebP |
| `FILE_WRITE_FAILED` | 500 | Could not save file to disk |

---

### `POST /api/cards/:cardId/back`

Upload the back image of a business card.

**Request**

```
Content-Type: multipart/form-data
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | Back image (JPEG, PNG, or WebP) |
| `original` | File | No | Uncropped original image |

**Response `200`**

```json
{
  "ok": true,
  "data": {
    "cardId": "2026-05-24_230501_ab12",
    "back": "back.jpg",
    "back_original": "back.original.jpg",
    "size": 232448,
    "uploaded_at": "2026-05-24T23:05:28+08:00"
  }
}
```

**Server behavior:**
1. Validates `cardId` exists
2. Accepts `image/jpeg`, `image/png`, `image/webp` (max 20MB)
3. Saves as `back.jpg` in card folder
4. Saves `back.original.jpg` if provided
5. Updates `status.json` → `back: "done"`
6. Updates `metadata.json` → `updated_at`, `files.back`, `files.back_original`

**Errors**

| Code | Status | Description |
|------|--------|-------------|
| `CARD_NOT_FOUND` | 404 | Invalid `cardId` |
| `FILE_MISSING` | 400 | No file in request |
| `FILE_TOO_LARGE` | 413 | File exceeds 20MB limit |
| `UNSUPPORTED_TYPE` | 415 | File is not JPEG, PNG, or WebP |
| `FILE_WRITE_FAILED` | 500 | Could not save file to disk |

---

### `POST /api/cards/:cardId/complete`

Mark a card capture session as complete.

**Response `200`**

```json
{
  "ok": true,
  "data": {
    "cardId": "2026-05-24_230501_ab12",
    "status": {
      "capture": "done",
      "front": "done",
      "back": "done",
      "ocr": "pending",
      "ai_parse": "pending",
      "review": "pending",
      "export": "pending"
    },
    "files": {
      "front": "front.jpg",
      "back": "back.jpg",
      "contact_md": "contact.md"
    }
  }
}
```

**Server behavior:**
1. Validates `cardId` exists
2. Checks that at least `front.jpg` exists
3. Updates `status.json` → `capture: "done"` (or `"partial"` if back missing)
4. Updates `contact.md` with current status
5. Updates `metadata.json` → `updated_at`

**Errors**

| Code | Status | Description |
|------|--------|-------------|
| `CARD_NOT_FOUND` | 404 | Invalid `cardId` |
| `NO_IMAGES` | 400 | No front or back image uploaded yet |

---

### `GET /api/cards`

List all captured cards.

**Query Parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | string | — | Filter by capture status: `done`, `partial`, `pending` |
| `sort` | string | `created_desc` | Sort: `created_desc`, `created_asc` |
| `limit` | number | 50 | Max results per page |
| `offset` | number | 0 | Pagination offset |

**Response `200`**

```json
{
  "ok": true,
  "data": {
    "cards": [
      {
        "id": "2026-05-24_230501_ab12",
        "created_at": "2026-05-24T23:05:01+08:00",
        "updated_at": "2026-05-24T23:06:22+08:00",
        "status": {
          "capture": "done",
          "front": "done",
          "back": "done",
          "ocr": "pending",
          "ai_parse": "pending",
          "review": "pending",
          "export": "pending"
        },
        "has_front": true,
        "has_back": true
      }
    ],
    "total": 42,
    "limit": 50,
    "offset": 0
  }
}
```

---

### `GET /api/cards/:cardId`

Get full details for a single card.

**Response `200`**

```json
{
  "ok": true,
  "data": {
    "id": "2026-05-24_230501_ab12",
    "metadata": {
      "id": "2026-05-24_230501_ab12",
      "created_at": "2026-05-24T23:05:01+08:00",
      "updated_at": "2026-05-24T23:06:22+08:00",
      "source": "mobile-web-camera",
      "capture_mode": "auto-front-back",
      "app_version": "0.1.0",
      "device": {
        "user_agent": "Mozilla/5.0 ...",
        "screen_width": 390,
        "screen_height": 844
      },
      "files": {
        "front": "front.jpg",
        "back": "back.jpg"
      },
      "tags": [],
      "notes": ""
    },
    "status": {
      "capture": "done",
      "front": "done",
      "back": "done",
      "ocr": "pending",
      "ai_parse": "pending",
      "review": "pending",
      "export": "pending",
      "errors": []
    },
    "files": {
      "front": "/cards/2026-05-24_230501_ab12/front.jpg",
      "front_original": "/cards/2026-05-24_230501_ab12/front.original.jpg",
      "back": "/cards/2026-05-24_230501_ab12/back.jpg",
      "back_original": "/cards/2026-05-24_230501_ab12/back.original.jpg",
      "contact_md": "/cards/2026-05-24_230501_ab12/contact.md"
    },
    "contact_md": "# Business Card Draft\n\n## Status\n- Capture: done\n..."
  }
}
```

**Errors**

| Code | Status | Description |
|------|--------|-------------|
| `CARD_NOT_FOUND` | 404 | Invalid `cardId` |

---

### `DELETE /api/cards/:cardId`

Delete a card and all its files.

**Response `200`**

```json
{
  "ok": true,
  "data": {
    "cardId": "2026-05-24_230501_ab12",
    "deleted": true
  }
}
```

**Errors**

| Code | Status | Description |
|------|--------|-------------|
| `CARD_NOT_FOUND` | 404 | Invalid `cardId` |
| `DELETE_FAILED` | 500 | Could not delete card folder |

---

### `PATCH /api/cards/:cardId`

Update card metadata (tags, notes).

**Request**

```json
{
  "tags": ["conference-2026", "tech"],
  "notes": "Met at PyCon 2026"
}
```

**Response `200`**

```json
{
  "ok": true,
  "data": {
    "cardId": "2026-05-24_230501_ab12",
    "metadata": {
      "tags": ["conference-2026", "tech"],
      "notes": "Met at PyCon 2026"
    }
  }
}
```

---

## Static Files

### `GET /cards/:cardId/:filename`

Serve card image or file directly.

**Examples:**

```
GET /cards/2026-05-24_230501_ab12/front.jpg
GET /cards/2026-05-24_230501_ab12/back.jpg
GET /cards/2026-05-24_230501_ab12/contact.md
```

Returns the raw file with appropriate `Content-Type`.

---

## Frontend Pages (SPA Routes)

| Route | Description |
|-------|-------------|
| `/` | Home page — server status, LAN URL, navigation |
| `/capture` | Mobile capture page — camera, guide frame, auto-capture |
| `/cards` | Card list — all captured cards with status |
| `/cards/:cardId` | Card detail — images, status, contact draft |

---

## Content Types

### Accepted Upload Types

| MIME Type | Extension |
|-----------|-----------|
| `image/jpeg` | `.jpg`, `.jpeg` |
| `image/png` | `.png` |
| `image/webp` | `.webp` |

### Upload Limits

| Limit | Value |
|-------|-------|
| Max file size | 20 MB |
| Max request body | 25 MB (multipart overhead) |

---

## Error Codes Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `CARD_NOT_FOUND` | 404 | Card ID does not exist |
| `FOLDER_CREATE_FAILED` | 500 | Server could not create card directory |
| `FILE_MISSING` | 400 | No file in multipart request |
| `FILE_TOO_LARGE` | 413 | Upload exceeds 20MB limit |
| `UNSUPPORTED_TYPE` | 415 | File type not JPEG, PNG, or WebP |
| `FILE_WRITE_FAILED` | 500 | Could not write file to disk |
| `NO_IMAGES` | 400 | Card has no images to complete |
| `DELETE_FAILED` | 500 | Could not delete card folder |
| `VALIDATION_ERROR` | 400 | Request body/params validation failed |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Future API Endpoints (v2+)

These endpoints are planned for future versions:

### OCR

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/cards/:cardId/ocr` | Run OCR on a single card |
| `POST` | `/api/cards/ocr/batch` | Run OCR on all pending cards |

### AI Parser

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/cards/:cardId/parse` | Run AI parser on a single card |
| `POST` | `/api/cards/parse/batch` | Run AI parser on all pending cards |

### Export

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/cards/:cardId/export/vcard` | Download vCard |
| `GET` | `/api/cards/:cardId/export/zip` | Download card folder as ZIP |
| `GET` | `/api/cards/export/csv` | Export all (or filtered) cards as CSV |
| `GET` | `/api/cards/export/json` | Export all (or filtered) cards as JSON |

### Review

| Method | Path | Description |
|--------|------|-------------|
| `PUT` | `/api/cards/:cardId/contact` | Save reviewed contact fields |
| `GET` | `/api/cards/review/next` | Get next card pending review |