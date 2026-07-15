export type AdminStoreOption = { id: string, name: string }

let storesCache: AdminStoreOption[] | null = null
let storesPromise: Promise<AdminStoreOption[]> | null = null

export async function fetchAdminStoresOnce(): Promise<AdminStoreOption[]> {
    if (storesCache) return storesCache
    if (!storesPromise) {
        storesPromise = fetch('/api/admin/stores')
            .then(async (res) => {
                if (!res.ok) return []
                const data = await res.json()
                return data.data?.stores || data.stores || []
            })
            .then((stores) => {
                storesCache = stores
                return stores
            })
            .finally(() => {
                storesPromise = null
            })
    }
    return storesPromise
}
