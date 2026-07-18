import { describe, expect, it } from 'vitest'
import {
  assertAttachmentUploadAllowed,
  fileExtension,
  GLOBAL_ALLOWED_MIME,
  mimeTypesForExtensions,
  parseFileTypesAttribute,
  parseMaxSizeMbAttribute,
} from '../src/modules/crm/attachments/attachment-upload.validation.js'
import { ValidationError } from '../src/utils/errors.js'

describe('attachment-upload.validation', () => {
  const globalMaxBytes = 25 * 1024 * 1024

  it('parses fileTypes and maxSizeMb attributes', () => {
    expect(parseFileTypesAttribute('pdf, jpg, JPEG')).toEqual(['pdf', 'jpg', 'jpeg'])
    expect(parseFileTypesAttribute(null)).toEqual([])
    expect(parseMaxSizeMbAttribute(10)).toBe(10)
    expect(parseMaxSizeMbAttribute('15')).toBe(15)
    expect(parseMaxSizeMbAttribute('bad', 8)).toBe(8)
  })

  it('maps extensions to MIME sets', () => {
    const mimes = mimeTypesForExtensions(['pdf', 'png'])
    expect(mimes.has('application/pdf')).toBe(true)
    expect(mimes.has('image/png')).toBe(true)
    expect(fileExtension('PO-1842.PDF')).toBe('pdf')
  })

  it('accepts valid customer_po PDF within size', () => {
    expect(() =>
      assertAttachmentUploadAllowed({
        originalFilename: 'po.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
        maxSizeMb: 10,
        globalMaxBytes,
        documentTypeLabel: 'Customer PO',
      }),
    ).not.toThrow()
  })

  it('rejects disallowed MIME for document type', () => {
    try {
      assertAttachmentUploadAllowed({
        originalFilename: 'sheet.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        sizeBytes: 2048,
        allowedExtensions: ['pdf', 'jpg', 'png'],
        maxSizeMb: 10,
        globalMaxBytes,
        documentTypeLabel: 'Customer PO',
      })
      expect.fail('expected ValidationError')
    } catch (e) {
      const err = e as ValidationError
      expect(err).toBeInstanceOf(ValidationError)
      expect(err.statusCode).toBe(400)
      expect(err.message).toMatch(/not allowed/i)
      expect(err.errors?.[0]?.field).toBe('originalFilename')
    }
  })

  it('rejects MIME that does not match allowed extensions', () => {
    try {
      assertAttachmentUploadAllowed({
        originalFilename: 'scan.pdf',
        mimeType: 'image/png',
        sizeBytes: 2048,
        allowedExtensions: ['pdf'],
        maxSizeMb: 10,
        globalMaxBytes,
        documentTypeLabel: 'Quotation PDF',
      })
      expect.fail('expected ValidationError')
    } catch (e) {
      const err = e as ValidationError
      expect(err.statusCode).toBe(400)
      expect(err.errors?.[0]?.field).toBe('mimeType')
    }
  })

  it('rejects globally unknown MIME', () => {
    expect(GLOBAL_ALLOWED_MIME.has('application/x-msdownload')).toBe(false)
    try {
      assertAttachmentUploadAllowed({
        originalFilename: 'virus.exe',
        mimeType: 'application/x-msdownload',
        sizeBytes: 100,
        allowedExtensions: [],
        maxSizeMb: 10,
        globalMaxBytes,
      })
      expect.fail('expected ValidationError')
    } catch (e) {
      const err = e as ValidationError
      expect(err.statusCode).toBe(400)
      expect(err.errors?.[0]?.field).toBe('mimeType')
    }
  })

  it('rejects oversize against document type max (before global cap)', () => {
    const elevenMb = 11 * 1024 * 1024
    try {
      assertAttachmentUploadAllowed({
        originalFilename: 'big.pdf',
        mimeType: 'application/pdf',
        sizeBytes: elevenMb,
        allowedExtensions: ['pdf'],
        maxSizeMb: 10,
        globalMaxBytes,
        documentTypeLabel: 'Customer PO',
      })
      expect.fail('expected ValidationError')
    } catch (e) {
      const err = e as ValidationError
      expect(err.statusCode).toBe(400)
      expect(err.message).toMatch(/10 MB/)
      expect(err.errors?.[0]?.field).toBe('contentBase64')
    }
  })

  it('caps type max by CRM_MAX_UPLOAD_BYTES (global)', () => {
    const twentyMb = 20 * 1024 * 1024
    try {
      assertAttachmentUploadAllowed({
        originalFilename: 'huge.pdf',
        mimeType: 'application/pdf',
        sizeBytes: twentyMb,
        allowedExtensions: ['pdf'],
        maxSizeMb: 50,
        globalMaxBytes: 15 * 1024 * 1024,
        documentTypeLabel: 'Tender Document',
      })
      expect.fail('expected ValidationError')
    } catch (e) {
      const err = e as ValidationError
      expect(err.statusCode).toBe(400)
      expect(err.message).toMatch(/15 MB/)
    }
  })

  it('allows dwg with octet-stream when extension is allowed', () => {
    expect(() =>
      assertAttachmentUploadAllowed({
        originalFilename: 'frame.dwg',
        mimeType: 'application/octet-stream',
        sizeBytes: 4096,
        allowedExtensions: ['pdf', 'dwg', 'dxf'],
        maxSizeMb: 25,
        globalMaxBytes,
        documentTypeLabel: 'Drawing',
      }),
    ).not.toThrow()
  })
})
