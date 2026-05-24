export interface CardMetadata {
  id:           string
  created_at:   string
  updated_at:   string
  source:       string
  capture_mode: string
  app_version:  string
  device: {
    user_agent:    string
    screen_width:  number
    screen_height: number
  }
  files: {
    front_original?: string
    front?:          string
    back_original?:  string
    back?:           string
  }
  tags:  string[]
  notes: string
}

export interface CardStatus {
  capture:   'pending' | 'partial' | 'done'
  front:     'pending' | 'done'
  back:      'pending' | 'done'
  ocr:       'pending' | 'in_progress' | 'done' | 'failed'
  ai_parse:  'pending' | 'in_progress' | 'done' | 'failed'
  review:    'pending' | 'done'
  export:    'pending' | 'done'
  errors:    string[]
}

export interface CardSummary {
  id:         string
  created_at: string
  updated_at: string
  status:     CardStatus
  has_front:  boolean
  has_back:   boolean
}

export interface ApiOk<T>  { ok: true;  data: T;    error: null }
export interface ApiError  { ok: false; data: null; error: { code: string; message: string } }
export type ApiResponse<T> = ApiOk<T> | ApiError
