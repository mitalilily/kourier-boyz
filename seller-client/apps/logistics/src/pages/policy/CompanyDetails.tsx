import {
  Box,
  Chip,
  Divider,
  Link,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { FiClock, FiGlobe, FiMail, FiMapPin, FiPhone } from 'react-icons/fi'
import PageHeading from '../../components/UI/heading/PageHeading'
import MapViewer from '../../components/UI/map/MapViewer'

const CompanyDetails = () => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const coords = { lat: 12.9962, lng: 77.5636 }

  return (
    <Stack mt={2} gap={5}>
      {/* Heading */}
      <PageHeading
        title="Contact Us"
        subtitle="  We’re here to help! Whether you have questions about our services, need support with your
        account, or want to know more about how Kourier Boyz can assist your business, feel free to
        reach out to us."
      />

      {/* Layout */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: 5,
        }}
      >
        {/* Left Column - Info */}
        <Paper
          elevation={4}
          sx={{
            flex: 1,
            p: 4,
            borderRadius: 3,
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            bgcolor: theme.palette.background.paper,
          }}
        >
          <Typography variant="h6" fontWeight="bold" color="secondary" gutterBottom>
            Kourier Boyz
          </Typography>

          {/* Address */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <FiMapPin size={22} color={theme.palette.primary.main} />
            <Typography fontSize="1rem">
              56/6, 7th Main, Srirampuram, Bangalore, Karnataka, India 560021
            </Typography>
          </Box>

          {/* Phone */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FiPhone size={22} color={theme.palette.primary.main} />
            <Chip
              clickable
              component={Link}
              href="tel:+917899990977"
              label="7899990977"
              color="primary"
              variant="filled"
              icon={<FiPhone size={16} />}
            />
          </Box>

          {/* Email */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FiMail size={22} color={theme.palette.primary.main} />
            <Chip
              clickable
              component={Link}
              href="mailto:info@kourierboyz.com"
              label="info@kourierboyz.com"
              color="primary"
              variant="filled"
              icon={<FiMail size={16} />}
            />
          </Box>

          {/* Website */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FiGlobe size={22} color={theme.palette.primary.main} />
            <Chip
              clickable
              component={Link}
              href="https://kourierboyz.com"
              target="_blank"
              rel="noreferrer"
              label="kourierboyz.com"
              color="secondary"
              variant="filled"
              icon={<FiGlobe size={16} />}
            />
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Timing */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <FiClock size={22} color={theme.palette.primary.main} />
            <Box>
              <Typography fontSize="1rem">Monday – Saturday: 10:00 AM – 7:00 PM</Typography>
              <Typography fontSize="1rem">Sunday: Closed</Typography>
            </Box>
          </Box>
        </Paper>

        {/* Right Column - Map */}
        <Paper
          elevation={4}
          sx={{
            flex: 1,
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <MapViewer
            coords={coords}
            height={isMobile ? '280px' : '400px'}
            width="100%"
            draggable={false}
            zoom={16}
            popupText="Kourier Boyz"
            currentLocation={false}
          />
        </Paper>
      </Box>
    </Stack>
  )
}

export default CompanyDetails
