/**
 * Review Content Moderation Utility
 *
 * This module provides content moderation for product reviews:
 * - Text moderation: Checks for violent, abusive, or inappropriate language
 * - Image moderation: Currently disabled - always returns approved
 * - Video moderation: Currently disabled - always returns approved
 *
 * Note: Image and video moderation functions are kept for future implementation
 * but currently return approved: true automatically.
 */

export interface ModerationResult {
  approved: boolean
  reason?: string
  confidence?: number
}

export interface TextModerationResult extends ModerationResult {
  flaggedWords?: string[]
}

export interface MediaModerationResult extends ModerationResult {
  flaggedItems?: string[]
}

// Comprehensive list of inappropriate words and phrases
// In production, this should be stored in a database or external service
const INAPPROPRIATE_WORDS = new Set([
  // Violent words
  'kill',
  'murder',
  'death',
  'die',
  'dead',
  'suicide',
  'bomb',
  'weapon',
  'gun',
  'knife',
  'violence',
  'violent',
  'attack',
  'assault',
  'fight',
  'war',
  'battle',
  'destroy',
  'harm',
  'hurt',
  'injure',
  'wound',
  'blood',
  'gore',
  'torture',
  'abuse',

  // Sexual content
  'sex',
  'sexual',
  'porn',
  'pornography',
  'nude',
  'naked',
  'nudity',
  'explicit',
  'xxx',
  'adult',
  'erotic',
  'orgasm',
  'masturbat',
  'genital',
  'penis',
  'vagina',

  // Abusive/hateful language
  'hate',
  'hateful',
  'racist',
  'racism',
  'discriminat',
  'slur',
  'offensive',
  'insult',
  'curse',
  'damn',
  'hell',
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'stupid',
  'idiot',
  'moron',
  'retard',
  'crap',
  'bullshit',

  // Scam/fraud related

  'counterfeit',
  'steal',
  'theft',
  'rob',

  // Common variations and leetspeak
  'f*ck',
  'f**k',
  'sh*t',
  'b*tch',
  'a**',
  'a$$',
  'd@mn',
  'h3ll',
])

// Words that might be false positives (context-dependent)
const ALLOWED_IN_CONTEXT = new Set([
  'kill switch',
  'killjoy',
  'deadline',
  'dead end',
  'dead weight',
  'sex education',
  'sexual health',
  'sexual orientation',
])

/**
 * Normalize text for moderation checking
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace special chars with spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
}

/**
 * Check if text contains inappropriate words
 */
function containsInappropriateWords(text: string): { found: boolean; words: string[] } {
  const normalized = normalizeText(text)
  const words = normalized.split(/\s+/)
  const foundWords: string[] = []

  for (const word of words) {
    // Check exact match
    if (INAPPROPRIATE_WORDS.has(word)) {
      // Check if it's in an allowed context
      const context = normalized.substring(
        Math.max(0, normalized.indexOf(word) - 20),
        Math.min(normalized.length, normalized.indexOf(word) + word.length + 20),
      )

      let isAllowed = false
      for (const allowed of ALLOWED_IN_CONTEXT) {
        if (context.includes(allowed)) {
          isAllowed = true
          break
        }
      }

      if (!isAllowed) {
        foundWords.push(word)
      }
    }

    // Check if word contains inappropriate substring (for leetspeak)
    for (const badWord of INAPPROPRIATE_WORDS) {
      if (word.includes(badWord) && word.length <= badWord.length + 3) {
        foundWords.push(word)
        break
      }
    }
  }

  return {
    found: foundWords.length > 0,
    words: [...new Set(foundWords)],
  }
}

/**
 * Moderate review text content (title + comment)
 */
export async function moderateText(
  title: string | undefined,
  comment: string,
): Promise<TextModerationResult> {
  const textToCheck = [title, comment].filter(Boolean).join(' ')

  if (!textToCheck || textToCheck.trim().length === 0) {
    return { approved: true }
  }

  const check = containsInappropriateWords(textToCheck)

  if (check.found) {
    return {
      approved: false,
      reason: 'Review contains inappropriate language',
      flaggedWords: check.words,
    }
  }

  return { approved: true }
}

/**
 * Moderate image content
 * Currently disabled - always returns approved
 */
export async function moderateImage(imageUrl: string): Promise<MediaModerationResult> {
  // Image moderation disabled for now
  return {
    approved: true,
  }
}

/**
 * Moderate image using Google Cloud Vision API
 */
async function moderateImageWithGoogleVision(
  imageBuffer: Buffer,
  contentType: string,
): Promise<MediaModerationResult> {
  try {
    // Dynamic import to avoid requiring the package if not using Google
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const vision = require('@google-cloud/vision')
    const client = new vision.ImageAnnotatorClient()

    const [result] = await client.safeSearchDetection({
      image: { content: imageBuffer },
    })

    const safeSearch = result.safeSearchAnnotation
    if (!safeSearch) {
      return {
        approved: false,
        reason: 'Could not analyze image content',
      }
    }

    // Google Vision returns: VERY_UNLIKELY, UNLIKELY, POSSIBLE, LIKELY, VERY_LIKELY
    const thresholds = {
      adult: ['LIKELY', 'VERY_LIKELY'],
      violence: ['LIKELY', 'VERY_LIKELY'],
      racy: ['LIKELY', 'VERY_LIKELY'],
    }

    const issues: string[] = []

    if (thresholds.adult.includes(safeSearch.adult)) {
      issues.push('adult content')
    }
    if (thresholds.violence.includes(safeSearch.violence)) {
      issues.push('violence')
    }
    if (thresholds.racy.includes(safeSearch.racy)) {
      issues.push('racy content')
    }

    if (issues.length > 0) {
      return {
        approved: false,
        reason: `Image contains inappropriate content: ${issues.join(', ')}`,
        confidence: 0.8,
      }
    }

    return {
      approved: true,
      confidence: 0.9,
    }
  } catch (error) {
    console.error('Google Vision API error:', error)
    throw error
  }
}

/**
 * Moderate image using AWS Rekognition
 */
async function moderateImageWithAWSRekognition(
  imageBuffer: Buffer,
  contentType: string,
): Promise<MediaModerationResult> {
  try {
    // Dynamic import to avoid requiring the package if not using AWS
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rekognition = require('@aws-sdk/client-rekognition')
    const { RekognitionClient, DetectModerationLabelsCommand } = rekognition

    const client = new RekognitionClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    })

    const command = new DetectModerationLabelsCommand({
      Image: {
        Bytes: imageBuffer,
      },
      MinConfidence: 60, // Minimum confidence threshold (0-100)
    })

    const response = await client.send(command)

    if (!response.ModerationLabels || response.ModerationLabels.length === 0) {
      return {
        approved: true,
        confidence: 0.9,
      }
    }

    // Filter for high-confidence inappropriate labels
    const inappropriateLabels = (response.ModerationLabels || []).filter(
      (label: { Confidence?: number }) => label.Confidence && label.Confidence >= 70,
    )

    if (inappropriateLabels.length > 0) {
      const labelNames = inappropriateLabels
        .map((label: { Name?: string }) => label.Name || 'inappropriate content')
        .join(', ')
      return {
        approved: false,
        reason: `Image contains inappropriate content: ${labelNames}`,
        confidence: ((inappropriateLabels[0] as { Confidence?: number }).Confidence || 0) / 100,
        flaggedItems: inappropriateLabels.map((label: { Name?: string }) => label.Name || ''),
      }
    }

    return {
      approved: true,
      confidence: 0.85,
    }
  } catch (error) {
    console.error('AWS Rekognition API error:', error)
    throw error
  }
}

/**
 * Moderate video content
 * Currently disabled - always returns approved
 */
export async function moderateVideo(videoUrl: string): Promise<MediaModerationResult> {
  // Video moderation disabled for now
  return {
    approved: true,
  }
}

/**
 * Moderate video using Google Cloud Video Intelligence API
 * Note: This requires the video to be accessible via a public URL or GCS URI
 */
async function moderateVideoWithGoogleVideoIntelligence(
  videoUrl: string,
): Promise<MediaModerationResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const videoIntelligence = require('@google-cloud/video-intelligence')
    const client = new videoIntelligence.VideoIntelligenceServiceClient()

    // For R2 URLs, we need to use the URL directly (if public) or download and upload to GCS
    // For simplicity, assuming the video URL is accessible
    const request = {
      inputUri: videoUrl,
      features: ['EXPLICIT_CONTENT_DETECTION'],
    }

    const [operation] = await client.annotateVideo(request)

    // Wait for the operation to complete (this can take time for videos)
    const [response] = await operation.promise()

    if (!response.annotationResults || response.annotationResults.length === 0) {
      return {
        approved: false,
        reason: 'Could not analyze video content',
      }
    }

    const explicitContent = response.annotationResults[0].explicitAnnotation
    if (!explicitContent || !explicitContent.frames) {
      return {
        approved: true,
        confidence: 0.8,
      }
    }

    // Check frames for inappropriate content
    const inappropriateFrames = explicitContent.frames.filter(
      (frame: { pornographyLikelihood?: string; violenceLikelihood?: string }) => {
        const pornLikely =
          frame.pornographyLikelihood === 'LIKELY' || frame.pornographyLikelihood === 'VERY_LIKELY'
        const violenceLikely =
          frame.violenceLikelihood === 'LIKELY' || frame.violenceLikelihood === 'VERY_LIKELY'
        return pornLikely || violenceLikely
      },
    )

    if (inappropriateFrames.length > 0) {
      const issues: string[] = []
      if (
        inappropriateFrames.some(
          (f: { pornographyLikelihood?: string }) => f.pornographyLikelihood === 'VERY_LIKELY',
        )
      ) {
        issues.push('adult content')
      }
      if (
        inappropriateFrames.some(
          (f: { violenceLikelihood?: string }) => f.violenceLikelihood === 'VERY_LIKELY',
        )
      ) {
        issues.push('violence')
      }

      return {
        approved: false,
        reason: `Video contains inappropriate content: ${issues.join(', ')}`,
        confidence: 0.85,
      }
    }

    return {
      approved: true,
      confidence: 0.9,
    }
  } catch (error) {
    console.error('Google Video Intelligence API error:', error)
    throw error
  }
}

/**
 * Moderate video using AWS Rekognition Video
 * Note: This is async and requires polling for results
 */
async function moderateVideoWithAWSRekognition(videoUrl: string): Promise<MediaModerationResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rekognition = require('@aws-sdk/client-rekognition')
    const { RekognitionClient, StartContentModerationCommand, GetContentModerationCommand } =
      rekognition

    const client = new RekognitionClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    })

    // Start content moderation job
    const startCommand = new StartContentModerationCommand({
      Video: {
        S3Object: {
          // Extract bucket and key from R2 URL, or use direct URL if supported
          Bucket: extractBucketFromUrl(videoUrl),
          Name: extractKeyFromUrl(videoUrl),
        },
      },
      MinConfidence: 60,
    })

    const startResponse = await client.send(startCommand)
    const jobId = startResponse.JobId

    if (!jobId) {
      throw new Error('Failed to start video moderation job')
    }

    // Poll for results (with timeout)
    const maxWaitTime = 300000 // 5 minutes
    const pollInterval = 5000 // 5 seconds
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval))

      const getCommand = new GetContentModerationCommand({ JobId: jobId })
      const getResponse = await client.send(getCommand)

      if (getResponse.JobStatus === 'SUCCEEDED') {
        const moderationLabels = getResponse.ModerationLabels || []

        if (moderationLabels.length === 0) {
          return {
            approved: true,
            confidence: 0.9,
          }
        }

        // Check for high-confidence inappropriate content
        const inappropriateLabels = moderationLabels.filter(
          (label: { ModerationLabel?: { Confidence?: number } }) =>
            label.ModerationLabel?.Confidence && label.ModerationLabel.Confidence >= 70,
        )

        if (inappropriateLabels.length > 0) {
          const labelNames = inappropriateLabels
            .map(
              (label: { ModerationLabel?: { Name?: string } }) =>
                label.ModerationLabel?.Name || 'inappropriate content',
            )
            .join(', ')
          return {
            approved: false,
            reason: `Video contains inappropriate content: ${labelNames}`,
            confidence:
              ((inappropriateLabels[0] as { ModerationLabel?: { Confidence?: number } })
                .ModerationLabel?.Confidence || 0) / 100,
            flaggedItems: inappropriateLabels.map(
              (label: { ModerationLabel?: { Name?: string } }) => label.ModerationLabel?.Name || '',
            ),
          }
        }

        return {
          approved: true,
          confidence: 0.85,
        }
      } else if (getResponse.JobStatus === 'FAILED') {
        throw new Error('Video moderation job failed')
      }
      // Continue polling if status is IN_PROGRESS
    }

    // Timeout - return pending
    return {
      approved: false,
      reason: 'Video moderation timed out - requires manual review',
    }
  } catch (error) {
    console.error('AWS Rekognition Video API error:', error)
    throw error
  }
}

/**
 * Helper to extract bucket from R2 URL
 */
function extractBucketFromUrl(url: string): string {
  // Extract from R2 public URL format: https://pub-xxx.r2.dev/bucket-name/path
  const match = url.match(/r2\.dev\/([^/]+)/)
  return match ? match[1] : 'default-bucket'
}

/**
 * Helper to extract key from R2 URL
 */
function extractKeyFromUrl(url: string): string {
  // Extract path after bucket name
  const match = url.match(/r2\.dev\/[^/]+\/(.+)/)
  return match ? match[1] : url
}

/**
 * Moderate all review content (text + images + videos)
 */
export async function moderateReviewContent(
  title: string | undefined,
  comment: string,
  images: string[],
  videos: string[],
): Promise<{
  approved: boolean
  reason?: string
  textResult?: TextModerationResult
  imageResults?: MediaModerationResult[]
  videoResults?: MediaModerationResult[]
}> {
  // Moderate text first (fastest check)
  const textResult = await moderateText(title, comment)
  if (!textResult.approved) {
    return {
      approved: false,
      reason: textResult.reason,
      textResult,
    }
  }

  // Moderate images (currently disabled - always approved)
  const imageResults: MediaModerationResult[] = []
  if (images && images.length > 0) {
    for (const imageUrl of images) {
      const result = await moderateImage(imageUrl)
      imageResults.push(result)
    }
  }

  // Moderate videos (currently disabled - always approved)
  const videoResults: MediaModerationResult[] = []
  if (videos && videos.length > 0) {
    for (const videoUrl of videos) {
      const result = await moderateVideo(videoUrl)
      videoResults.push(result)
    }
  }

  // Auto-approve if text passed (even if has media, since media moderation is disabled)
  // Previously, reviews with media were set to pending, but we'll auto-approve them now
  return {
    approved: true, // Auto-approve if text passed
    textResult,
    imageResults,
    videoResults,
  }
}
