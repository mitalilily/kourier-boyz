import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from '@mui/material'

type DetailValue = string | number | boolean | null | undefined

type DetailField = {
  label: string
  value: DetailValue
}

type DetailSection = {
  title: string
  fields?: DetailField[]
  raw?: unknown
}

type ManualRequestDetailsDialogProps = {
  open: boolean
  title: string
  subtitle?: string
  sections: DetailSection[]
  onClose: () => void
}

const formatValue = (value: DetailValue) => {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

const RawBlock = ({ value }: { value: unknown }) => {
  if (value === null || value === undefined || value === '') return null

  return (
    <Box
      component="pre"
      sx={{
        m: 0,
        p: 1.5,
        borderRadius: 1.5,
        bgcolor: '#F8FAFC',
        border: '1px solid #E2E8F0',
        color: '#334155',
        fontSize: '0.78rem',
        lineHeight: 1.6,
        overflow: 'auto',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
    </Box>
  )
}

export default function ManualRequestDetailsDialog({
  open,
  title,
  subtitle,
  sections,
  onClose,
}: ManualRequestDetailsDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ pb: 1 }}>
        <Typography sx={{ fontWeight: 800, color: '#111827' }}>{title}</Typography>
        {subtitle ? (
          <Typography sx={{ mt: 0.5, color: '#64748B', fontSize: '0.88rem' }}>{subtitle}</Typography>
        ) : null}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          {sections.map((section) => (
            <Box key={section.title}>
              <Typography sx={{ fontWeight: 800, color: '#1F2937', mb: 1 }}>
                {section.title}
              </Typography>
              {section.fields?.length ? (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                    gap: 1.25,
                  }}
                >
                  {section.fields.map((field) => (
                    <Box
                      key={`${section.title}-${field.label}`}
                      sx={{
                        border: '1px solid #E5E7EB',
                        borderRadius: 1.5,
                        p: 1.25,
                        minWidth: 0,
                      }}
                    >
                      <Typography sx={{ color: '#64748B', fontSize: '0.74rem', fontWeight: 700 }}>
                        {field.label}
                      </Typography>
                      <Typography sx={{ color: '#111827', fontSize: '0.9rem', wordBreak: 'break-word' }}>
                        {formatValue(field.value)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              ) : null}
              {section.raw !== undefined ? (
                <Box sx={{ mt: section.fields?.length ? 1.25 : 0 }}>
                  <RawBlock value={section.raw} />
                </Box>
              ) : null}
              <Divider sx={{ mt: 2 }} />
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="contained" sx={{ textTransform: 'none', borderRadius: 1.5 }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}
