# VPS deployment layout

Kourier Boyz is deployed independently from other applications on the host.

| Service | Internal port | Direct preview |
| --- | ---: | ---: |
| Unified API | 4100 | `http://SERVER_IP:4100/health` |
| Landing and storefront | 4170 | Nginx port 8080 |
| Seller console | 4171 | Nginx port 8081 |
| Admin console | 4172 | Nginx port 8082 |
| PostgreSQL | 55432 on localhost | Not public |

The PM2 ecosystem reads production secrets from
`/opt/apps/kourier-boyz/shared/backend.env`. The database Compose service reads
`/opt/apps/kourier-boyz/shared/database.env`. Neither file belongs in Git.

The Nginx configuration includes temporary direct-preview listeners and the
final `kourierboyz.com`, `seller.kourierboyz.com`, `admin.kourierboyz.com`, and
`api.kourierboyz.com` hosts. HTTPS certificates should be requested only after
all DNS records resolve to the deployment server.
