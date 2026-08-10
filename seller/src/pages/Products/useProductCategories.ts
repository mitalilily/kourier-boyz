import { useEffect, useState } from 'react'
import { getActiveCategories, type Category, type CertificateType } from '../../api/categories'
import { getMyCategoryRequests } from '../../api/categoryRequests'

/**
 * Loads platform categories + seller approved custom categories, deduped by id.
 */
const useProductCategories = () => {
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    ;(async () => {
      try {
        const [platformCats, rawMyRequests] = await Promise.all([
          getActiveCategories(true), // Include subcategories
          getMyCategoryRequests().catch(() => []),
        ])

        // Normalize myRequests to always be an array
        const myRequests: Array<{
          _id?: string
          name?: string
          description?: string
          status?: 'pending' | 'approved' | 'rejected'
          adminNote?: string
          requiredCertificates?: CertificateType[]
          overrideParentCertificateRule?: boolean
          parent?: { _id: string; name: string; slug: string } | string | null
          createdAt?: string
        }> = Array.isArray(rawMyRequests)
          ? (rawMyRequests as Array<unknown>).filter(
              (
                r,
              ): r is {
                _id?: string
                name?: string
                description?: string
                status?: 'pending' | 'approved' | 'rejected'
                adminNote?: string
                requiredCertificates?: CertificateType[]
                overrideParentCertificateRule?: boolean
                parent?: { _id: string; name: string; slug: string } | string | null
                createdAt?: string
              } => !!r && typeof r === 'object',
            )
          : Array.isArray((rawMyRequests as { data?: unknown })?.data)
          ? ((rawMyRequests as { data?: unknown }).data as Array<unknown>).filter(
              (
                r,
              ): r is {
                _id?: string
                name?: string
                description?: string
                status?: 'pending' | 'approved' | 'rejected'
                adminNote?: string
                requiredCertificates?: CertificateType[]
                overrideParentCertificateRule?: boolean
                parent?: { _id: string; name: string; slug: string } | string | null
                createdAt?: string
              } => !!r && typeof r === 'object',
            )
          : []

        const approvedRequests = myRequests.filter((r) => r.status === 'approved')

        // Merge categories including subcategories
        const allCategories: Category[] = [...platformCats]

        // Add approved custom categories
        approvedRequests.forEach(
          (r: {
            _id?: string
            name?: string
            slug?: string
            requiredCertificates?: CertificateType[]
            overrideParentCertificateRule?: boolean
            parent?: string | { _id?: string } | null
          }) => {
            if (r?._id && r?.name) {
              // Check if category already exists
              const exists = allCategories.some((cat) => cat._id === r._id)
              if (!exists) {
                const required = r.requiredCertificates || []
                allCategories.push({
                  _id: r._id,
                  name: r.name,
                  slug: r.slug || r.name.toLowerCase().replace(/\s+/g, '-'),
                  mainImage: '',
                  hoverImage: '',
                  banners: [],
                  status: 'active',
                  requiredCertificates: required,
                  effectiveRequiredCertificates: required,
                  inheritedRequiredCertificates: [],
                  overrideParentCertificateRule: r.overrideParentCertificateRule ?? false,
                  inheritsParentCertificateRule:
                    r.overrideParentCertificateRule ?? false ? false : Boolean(r?.parent),
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                } as Category)
              }
            }
          },
        )

        setCategories(allCategories)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e)
      }
    })()
  }, [])

  return categories
}

export default useProductCategories























