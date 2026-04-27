// Endpoint catalog. Each API block defines its own baseUrl, auth keys,
// and categorized endpoints. Endpoints may declare:
//   auth        : which authKey id to send (defaults to api.defaultAuth; 'none' = no auth)
//   pathParams  : ordered list of {name} placeholders to prompt for
//   queryParams : [{ name, desc, default }]
//   bodyTemplate: prefilled JSON body object
//   geoHeaders  : true if the endpoint honors x-country-code-override / x-region-code-override

const APIS = [
  // ===========================================================================
  //  Customer REST API — api.osano.com (x-osano-api-key)
  // ===========================================================================
  {
    id: 'customer',
    name: 'Customer REST API',
    shortName: 'Customer API',
    description: 'api.osano.com',
    baseUrl: 'https://api.osano.com',
    authKeys: [
      { id: 'default', label: 'API Key (x-osano-api-key)', headerName: 'x-osano-api-key', type: 'password' },
    ],
    defaultAuth: 'default',
    categories: [
      {
        id: 'cookie-consent',
        name: 'Cookie Consent',
        endpoints: [
          {
            id: 'list-cookie-configs',
            method: 'GET',
            path: '/v1/cookie-consent/configs',
            title: 'List Cookie Consent Configurations',
            queryParams: [
              { name: 'name',    desc: 'Filter by name (case-insensitive, partial)' },
              { name: 'domains', desc: 'Comma-separated domains (any:/all:/not: prefix allowed)' },
              { name: 'limit',   desc: 'Max results (<=1000)', default: '100' },
              { name: 'next',    desc: 'Pagination token' },
              { name: 'sortBy',  desc: 'Sort by (name|created|updated|lastPublished)', default: 'created' },
              { name: 'orgIds',  desc: 'Comma-separated org UUIDs' },
              { name: 'mode',    desc: 'Compliance mode (debug|permissive|production)' },
              { name: 'status',  desc: 'Publish status (unpublished|in-progress|published|outdated|error)' },
              { name: 'tattleRecordStopped', desc: 'Tattle record stopped (true|false)' },
            ],
          },
          {
            id: 'create-cookie-config',
            method: 'POST',
            path: '/v1/cookie-consent/configs',
            title: 'Create New Cookie Consent Configuration',
            bodyTemplate: {
              name: 'My Config',
              domains: ['example.com'],
              orgIds: [],
              mode: 'production',
              configuration: { allowTimeout: true, dntSupport: true, gpcSupport: true },
            },
          },
          {
            id: 'get-cookie-config',
            method: 'GET',
            path: '/v1/cookie-consent/configs/{configId}',
            title: 'Get Cookie Consent Configuration',
            pathParams: ['configId'],
          },
          {
            id: 'update-cookie-config',
            method: 'PATCH',
            path: '/v1/cookie-consent/configs/{configId}',
            title: 'Update Cookie Consent Configuration',
            pathParams: ['configId'],
            bodyTemplate: { name: 'Updated Name', mode: 'production' },
          },
          {
            id: 'publish-cookie-config',
            method: 'POST',
            path: '/v1/cookie-consent/configs/{configId}/publish',
            title: 'Publish Cookie Consent Configuration',
            pathParams: ['configId'],
          },
          {
            id: 'list-config-discoveries',
            method: 'GET',
            path: '/v1/cookie-consent/configs/{configId}/discoveries',
            title: 'List Configuration Discoveries',
            pathParams: ['configId'],
            queryParams: [
              { name: 'limit', desc: 'Max results', default: '100' },
              { name: 'next',  desc: 'Pagination token' },
            ],
          },
          {
            id: 'list-config-rules',
            method: 'GET',
            path: '/v1/cookie-consent/configs/{configId}/rules',
            title: 'List Configuration Rules',
            pathParams: ['configId'],
            queryParams: [
              { name: 'limit', desc: 'Max results', default: '100' },
              { name: 'next',  desc: 'Pagination token' },
            ],
          },
          {
            id: 'create-cookie-rules',
            method: 'POST',
            path: '/v1/cookie-consent/rules',
            title: 'Create New Cookie Consent Rules',
            bodyTemplate: {
              configId: 'uuid-here',
              rules: [
                { name: 'Example rule', category: 'ESSENTIAL', matchType: 'exact', pattern: 'example.com' },
              ],
            },
          },
          {
            id: 'update-cookie-rule',
            method: 'PATCH',
            path: '/v1/cookie-consent/rules/{ruleId}',
            title: 'Update Cookie Consent Rule',
            pathParams: ['ruleId'],
            bodyTemplate: { category: 'ANALYTICS' },
          },
          {
            id: 'delete-cookie-rule',
            method: 'DELETE',
            path: '/v1/cookie-consent/rules/{ruleId}',
            title: 'Delete Cookie Consent Rule',
            pathParams: ['ruleId'],
          },
        ],
      },

      {
        id: 'connectors',
        name: 'Connectors',
        endpoints: [
          {
            id: 'list-connectors',
            method: 'GET',
            path: '/v1/connectors',
            title: 'List Connectors',
            queryParams: [
              { name: 'limit', desc: 'Max results', default: '100' },
              { name: 'next',  desc: 'Pagination token' },
            ],
          },
          {
            id: 'list-dd-connectors',
            method: 'GET',
            path: '/v1/data-discovery/connectors',
            title: 'List Data Discovery Connectors',
            queryParams: [
              { name: 'limit', desc: 'Max results', default: '100' },
              { name: 'next',  desc: 'Pagination token' },
            ],
          },
        ],
      },

      {
        id: 'subject-rights',
        name: 'Subject Rights Requests',
        endpoints: [
          {
            id: 'list-srr',
            method: 'GET',
            path: '/v1/subject-rights/requests',
            title: 'List Subject Rights Requests',
            queryParams: [
              { name: 'limit',  desc: 'Max results', default: '100' },
              { name: 'next',   desc: 'Pagination token' },
              { name: 'status', desc: 'Status filter' },
              { name: 'type',   desc: 'Request type' },
            ],
          },
          {
            id: 'create-srr',
            method: 'POST',
            path: '/v1/subject-rights/requests',
            title: 'Create Subject Rights Request',
            bodyTemplate: {
              type: 'access',
              subject: { email: 'user@example.com', firstName: 'First', lastName: 'Last' },
            },
          },
          {
            id: 'get-srr',
            method: 'GET',
            path: '/v1/subject-rights/requests/{dsarId}',
            title: 'Get Subject Rights Request',
            pathParams: ['dsarId'],
          },
          {
            id: 'update-srr',
            method: 'PATCH',
            path: '/v1/subject-rights/requests/{dsarId}',
            title: 'Update Subject Rights Request',
            pathParams: ['dsarId'],
            bodyTemplate: { status: 'in-progress' },
          },
          {
            id: 'srr-identification',
            method: 'POST',
            path: '/v1/subject-rights/requests/{dsarId}/identification',
            title: 'Update Identification Photo',
            pathParams: ['dsarId'],
            bodyTemplate: { identificationPhoto: 'base64-encoded-image-data' },
          },
          {
            id: 'srr-summaries',
            method: 'GET',
            path: '/v1/subject-rights/requests/{requestId}/summaries',
            title: 'Get Request Summaries',
            pathParams: ['requestId'],
            queryParams: [
              { name: 'limit', desc: 'Max results', default: '100' },
              { name: 'next',  desc: 'Pagination token' },
            ],
          },
          {
            id: 'srr-get-summary-notif',
            method: 'GET',
            path: '/v1/subject-rights/requests/{requestId}/summary-notification',
            title: 'Get Summary Notification',
            pathParams: ['requestId'],
          },
          {
            id: 'srr-send-summary-notif',
            method: 'POST',
            path: '/v1/subject-rights/requests/{requestId}/summary-notification',
            title: 'Send Summary Notification',
            pathParams: ['requestId'],
            bodyTemplate: { notify: true },
          },
          {
            id: 'srr-activity-log',
            method: 'POST',
            path: '/v1/subject-rights/requests/{requestId}/activity-log',
            title: 'Create Activity Log Entry',
            pathParams: ['requestId'],
            bodyTemplate: { message: 'Offline activity entry', occurredAt: 0 },
          },
          {
            id: 'srr-get-portal-messages',
            method: 'GET',
            path: '/v1/subject-rights/requests/{requestId}/portal-messages',
            title: 'Get Portal Messages',
            pathParams: ['requestId'],
            queryParams: [
              { name: 'limit', desc: 'Max results', default: '100' },
              { name: 'next',  desc: 'Pagination token' },
            ],
          },
          {
            id: 'srr-create-portal-message',
            method: 'POST',
            path: '/v1/subject-rights/requests/{requestId}/portal-messages',
            title: 'Create Portal Message',
            pathParams: ['requestId'],
            bodyTemplate: { message: 'Hello from the admin portal.' },
          },
          {
            id: 'srr-update-portal-message',
            method: 'PATCH',
            path: '/v1/subject-rights/requests/{requestId}/portal-messages/{messageId}',
            title: 'Update Portal Message',
            pathParams: ['requestId', 'messageId'],
            bodyTemplate: { read: true },
          },
        ],
      },

      {
        id: 'dd-data-stores',
        name: 'Data Discovery — Data Stores',
        endpoints: [
          {
            id: 'list-dd-data-stores',
            method: 'GET',
            path: '/v1/data-discovery/data-stores',
            title: 'List Data Stores',
            queryParams: [
              { name: 'limit',  desc: 'Max results', default: '100' },
              { name: 'next',   desc: 'Pagination token' },
              { name: 'name',   desc: 'Filter by name' },
              { name: 'labels', desc: 'Comma-separated labels' },
            ],
          },
          {
            id: 'create-dd-data-store',
            method: 'POST',
            path: '/v1/data-discovery/data-stores',
            title: 'Create New Data Store',
            bodyTemplate: { name: 'My Data Store', connectorId: 'uuid-here', labels: [] },
          },
          {
            id: 'list-dd-data-store-labels',
            method: 'GET',
            path: '/v1/data-discovery/data-stores/labels',
            title: 'List Data Store Labels',
            queryParams: [
              { name: 'limit', desc: 'Max results', default: '100' },
              { name: 'next',  desc: 'Pagination token' },
            ],
          },
          {
            id: 'get-dd-data-store',
            method: 'GET',
            path: '/v1/data-discovery/data-stores/{dataStoreId}',
            title: 'Get Data Store',
            pathParams: ['dataStoreId'],
          },
          {
            id: 'delete-dd-data-store',
            method: 'DELETE',
            path: '/v1/data-discovery/data-stores/{dataStoreId}',
            title: 'Delete Data Store',
            pathParams: ['dataStoreId'],
          },
          {
            id: 'update-dd-data-store',
            method: 'PATCH',
            path: '/v1/data-discovery/data-stores/{dataStoreId}',
            title: 'Update Data Store',
            pathParams: ['dataStoreId'],
            bodyTemplate: { name: 'Renamed Data Store' },
          },
          {
            id: 'put-dd-data-store-fields',
            method: 'PUT',
            path: '/v1/data-discovery/data-stores/{dataStoreId}/fields',
            title: 'Update Data Store Fields (replace set)',
            pathParams: ['dataStoreId'],
            bodyTemplate: { fields: [{ name: 'email', classification: 'PII' }] },
          },
          {
            id: 'get-dd-data-store-fields',
            method: 'GET',
            path: '/v1/data-discovery/data-stores/{dataStoreId}/fields',
            title: 'List Data Store Fields',
            pathParams: ['dataStoreId'],
            queryParams: [
              { name: 'limit', desc: 'Max results', default: '100' },
              { name: 'next',  desc: 'Pagination token' },
            ],
          },
          {
            id: 'delete-dd-data-store-field',
            method: 'DELETE',
            path: '/v1/data-discovery/data-stores/{dataStoreId}/fields/{fieldId}',
            title: 'Delete Field',
            pathParams: ['dataStoreId', 'fieldId'],
          },
          {
            id: 'update-dd-data-store-field',
            method: 'PATCH',
            path: '/v1/data-discovery/data-stores/{dataStoreId}/fields/{fieldId}',
            title: 'Update Field',
            pathParams: ['dataStoreId', 'fieldId'],
            bodyTemplate: { classification: 'PII' },
          },
        ],
      },

      {
        id: 'data-stores-legacy',
        name: 'Data Stores (legacy)',
        endpoints: [
          {
            id: 'list-data-stores',
            method: 'GET',
            path: '/v1/data-stores',
            title: 'List Data Stores (legacy)',
            queryParams: [
              { name: 'limit', desc: 'Max results', default: '100' },
              { name: 'next',  desc: 'Pagination token' },
            ],
          },
          {
            id: 'create-data-store',
            method: 'POST',
            path: '/v1/data-stores',
            title: 'Create Data Store (legacy)',
            bodyTemplate: { name: 'My Data Store' },
          },
          { id: 'get-data-store', method: 'GET', path: '/v1/data-stores/{dataStoreId}', title: 'Get Data Store', pathParams: ['dataStoreId'] },
          { id: 'delete-data-store', method: 'DELETE', path: '/v1/data-stores/{dataStoreId}', title: 'Delete Data Store', pathParams: ['dataStoreId'] },
          {
            id: 'update-data-store',
            method: 'PATCH',
            path: '/v1/data-stores/{dataStoreId}',
            title: 'Update Data Store',
            pathParams: ['dataStoreId'],
            bodyTemplate: { name: 'Renamed' },
          },
          {
            id: 'put-data-store-fields',
            method: 'PUT',
            path: '/v1/data-stores/{dataStoreId}/fields',
            title: 'Replace Data Store Fields',
            pathParams: ['dataStoreId'],
            bodyTemplate: { fields: [{ name: 'email', classification: 'PII' }] },
          },
          {
            id: 'get-data-store-fields',
            method: 'GET',
            path: '/v1/data-stores/{dataStoreId}/fields',
            title: 'List Data Store Fields',
            pathParams: ['dataStoreId'],
            queryParams: [
              { name: 'limit', desc: 'Max results', default: '100' },
              { name: 'next',  desc: 'Pagination token' },
            ],
          },
          {
            id: 'delete-data-store-field',
            method: 'DELETE',
            path: '/v1/data-stores/{dataStoreId}/fields/{fieldId}',
            title: 'Delete Field',
            pathParams: ['dataStoreId', 'fieldId'],
          },
          {
            id: 'update-data-store-field',
            method: 'PATCH',
            path: '/v1/data-stores/{dataStoreId}/fields/{fieldId}',
            title: 'Update Field',
            pathParams: ['dataStoreId', 'fieldId'],
            bodyTemplate: { classification: 'PII' },
          },
        ],
      },

      {
        id: 'dsar-action-items-legacy',
        name: 'DSAR Action Items (legacy)',
        endpoints: [
          {
            id: 'list-dsar-action-items',
            method: 'GET',
            path: '/v1/dsar-action-items',
            title: 'List DSAR Action Items',
            queryParams: [
              { name: 'limit',  desc: 'Max results', default: '100' },
              { name: 'next',   desc: 'Pagination token' },
              { name: 'status', desc: 'Status filter' },
              { name: 'dsarId', desc: 'Filter by DSAR id' },
            ],
          },
          { id: 'get-dsar-action-item', method: 'GET', path: '/v1/dsar-action-items/{actionItemId}', title: 'Get DSAR Action Item', pathParams: ['actionItemId'] },
          {
            id: 'update-dsar-action-item',
            method: 'PATCH',
            path: '/v1/dsar-action-items/{actionItemId}',
            title: 'Update DSAR Action Item',
            pathParams: ['actionItemId'],
            bodyTemplate: { status: 'completed' },
          },
          {
            id: 'get-dsar-ai-summary',
            method: 'GET',
            path: '/v1/dsar-action-items/{actionItemId}/summary-entry',
            title: 'Get Summary Entry',
            pathParams: ['actionItemId'],
          },
          {
            id: 'create-dsar-ai-summary',
            method: 'POST',
            path: '/v1/dsar-action-items/{actionItemId}/summary-entry',
            title: 'Create Summary Entry',
            pathParams: ['actionItemId'],
            bodyTemplate: { entry: 'Description of completed work' },
          },
          {
            id: 'update-dsar-ai-summary',
            method: 'PATCH',
            path: '/v1/dsar-action-items/{actionItemId}/summary-entry/{dsarSummaryEntryId}',
            title: 'Update Summary Entry',
            pathParams: ['actionItemId', 'dsarSummaryEntryId'],
            bodyTemplate: { entry: 'Updated description' },
          },
        ],
      },

      {
        id: 'sr-action-items',
        name: 'Subject Rights Action Items',
        endpoints: [
          {
            id: 'list-sr-action-items',
            method: 'GET',
            path: '/v1/subject-rights/action-items',
            title: 'List Subject Rights Action Items',
            queryParams: [
              { name: 'limit',     desc: 'Max results', default: '100' },
              { name: 'next',      desc: 'Pagination token' },
              { name: 'status',    desc: 'Status filter' },
              { name: 'requestId', desc: 'Filter by request id' },
            ],
          },
          { id: 'get-sr-action-item', method: 'GET', path: '/v1/subject-rights/action-items/{actionItemId}', title: 'Get Action Item', pathParams: ['actionItemId'] },
          {
            id: 'update-sr-action-item',
            method: 'PATCH',
            path: '/v1/subject-rights/action-items/{actionItemId}',
            title: 'Update Action Item',
            pathParams: ['actionItemId'],
            bodyTemplate: { status: 'completed' },
          },
          {
            id: 'list-sr-ai-summaries',
            method: 'GET',
            path: '/v1/subject-rights/action-items/{actionItemId}/summaries',
            title: 'List Summaries',
            pathParams: ['actionItemId'],
            queryParams: [
              { name: 'limit', desc: 'Max results', default: '100' },
              { name: 'next',  desc: 'Pagination token' },
            ],
          },
          {
            id: 'create-sr-ai-summary',
            method: 'POST',
            path: '/v1/subject-rights/action-items/{actionItemId}/summaries',
            title: 'Create Summary',
            pathParams: ['actionItemId'],
            bodyTemplate: { entry: 'Summary of work done' },
          },
          {
            id: 'update-sr-ai-summary',
            method: 'PATCH',
            path: '/v1/subject-rights/action-items/{actionItemId}/summaries/{dsarSummaryEntryId}',
            title: 'Update Summary',
            pathParams: ['actionItemId', 'dsarSummaryEntryId'],
            bodyTemplate: { entry: 'Updated description' },
          },
          {
            id: 'sr-ai-activity-log',
            method: 'POST',
            path: '/v1/subject-rights/action-items/{actionItemId}/activity-log',
            title: 'Create Activity Log Entry',
            pathParams: ['actionItemId'],
            bodyTemplate: { message: 'Offline activity', occurredAt: 0 },
          },
        ],
      },

      {
        id: 'customer-insights',
        name: 'Customer Insights',
        endpoints: [
          {
            id: 'customer-insights',
            method: 'GET',
            path: '/v1/customer-insights',
            title: 'Customer Insights',
            queryParams: [
              { name: 'limit', desc: 'Max results', default: '100' },
              { name: 'next',  desc: 'Pagination token' },
              { name: 'from',  desc: 'From timestamp (epoch ms)' },
              { name: 'to',    desc: 'To timestamp (epoch ms)' },
            ],
          },
        ],
      },
    ],
  },

  // ===========================================================================
  //  Unified Consent Core API — uc.api.osano.com (x-uc-api-key + x-osano-api-key)
  // ===========================================================================
  {
    id: 'uc',
    name: 'Unified Consent API',
    shortName: 'Unified Consent',
    description: 'uc.api.osano.com · v2.0.0',
    baseUrl: 'https://uc.api.osano.com',
    authKeys: [
      { id: 'uc',    label: 'x-uc-api-key',    headerName: 'x-uc-api-key',    type: 'password' },
      { id: 'osano', label: 'x-osano-api-key', headerName: 'x-osano-api-key', type: 'password',
        hint: 'Admin key — required for subject merge, create-profile, create-code.' },
    ],
    defaultAuth: 'uc',
    categories: [
      {
        id: 'consents',
        name: 'Consents',
        endpoints: [
          {
            id: 'get-unified-consent',
            method: 'GET',
            path: '/v2/consents/unified/{subjectRef}',
            title: 'Retrieve unified consent',
            pathParams: ['subjectRef'],
            queryParams: [
              { name: 'ref', desc: 'Reference type (subject|session)' },
            ],
            geoHeaders: true,
          },
          {
            id: 'check-consent',
            method: 'GET',
            path: '/v2/consents/check/{subjectId}',
            title: 'Check if subject has consent',
            pathParams: ['subjectId'],
            geoHeaders: true,
          },
          {
            id: 'get-consent-profile',
            method: 'GET',
            path: '/v2/consent-profiles/{hashedSubjectId}',
            title: 'Retrieve unified consent by hashed ID',
            pathParams: ['hashedSubjectId'],
            queryParams: [
              { name: 'configId', desc: 'Configuration ID' },
            ],
            geoHeaders: true,
          },
          {
            id: 'create-consent',
            method: 'POST',
            path: '/v2/consents',
            title: 'Create and insert a consent',
            geoHeaders: true,
            bodyTemplate: {
              sessionToken: 'optional-session-token',
              subject: { verifiedId: 'string', anonymousId: 'string' },
              compliance: {
                privacyPolicy: { version: '1.0', url: 'https://example.com/privacy' },
                gpc: 0,
              },
              actions: [
                { target: 'privacy-protocol-id', vendor: 'uc-config-id', action: 'granted', jurisdiction: null },
              ],
              attributes: {},
              origin: 'api',
              jurisdiction: 'US-CA',
            },
          },
          {
            id: 'create-gpc-consent',
            method: 'POST',
            path: '/v2/consents/gpc',
            title: 'Create and insert a GPC consent',
            geoHeaders: true,
            bodyTemplate: {
              subject: { verifiedId: 'string', anonymousId: 'string' },
              compliance: { gpc: 1 },
              attributes: {},
              jurisdiction: 'US-CA',
            },
          },
        ],
      },

      {
        id: 'collections',
        name: 'Collections',
        endpoints: [
          {
            id: 'list-collections',
            method: 'GET',
            path: '/v2/collections',
            title: 'Retrieve collections by jurisdiction',
            queryParams: [
              { name: 'jurisdiction', desc: 'Jurisdiction (e.g. US-CA). Blank = IP geolocation' },
              { name: 'type',         desc: 'Type (published|draft)', default: 'published' },
            ],
          },
          {
            id: 'get-collection',
            method: 'GET',
            path: '/v2/collections/{collectionId}',
            title: 'Retrieve a collection',
            pathParams: ['collectionId'],
          },
        ],
      },

      {
        id: 'subjects',
        name: 'Subjects',
        endpoints: [
          {
            id: 'get-subject',
            method: 'GET',
            path: '/v2/subjects/{subjectRef}',
            title: 'Get subject by id or session',
            pathParams: ['subjectRef'],
            queryParams: [
              { name: 'ref', desc: 'Reference type (subject|session)' },
            ],
          },
          {
            id: 'get-subject-profile',
            method: 'GET',
            path: '/v2/subjects/{id}/profile',
            title: 'Get a subject profile',
            pathParams: ['id'],
          },
          {
            id: 'merge-subjects',
            method: 'POST',
            path: '/v2/subjects/merge',
            title: 'Merge anonymous and verified subjects',
            auth: 'osano',
            bodyTemplate: {
              sourceSubjectId: 'anonymous-subject-id',
              targetSubjectId: 'verified-subject-id',
            },
          },
          {
            id: 'create-subject-profile',
            method: 'POST',
            path: '/v2/subjects/profile',
            title: 'Create and insert a subject profile',
            auth: 'osano',
            queryParams: [
              { name: 'resultType', desc: 'Result type (subject|session)' },
            ],
            bodyTemplate: {
              email: 'user@example.com',
              phone: '+15551234567',
              profile: { firstName: 'First', lastName: 'Last' },
            },
          },
          {
            id: 'send-code-email',
            method: 'POST',
            path: '/v2/subjects/send-code',
            title: 'Send verification email',
            bodyTemplate: { email: 'user@example.com' },
          },
          {
            id: 'send-code-sms',
            method: 'POST',
            path: '/v2/subjects/send-code/sms',
            title: 'Send verification SMS',
            bodyTemplate: { phone: '+15551234567' },
          },
          {
            id: 'verify-email',
            method: 'POST',
            path: '/v2/subjects/profile/verify',
            title: 'Verify profile using email code',
            bodyTemplate: { email: 'user@example.com', code: '123456' },
          },
          {
            id: 'verify-sms',
            method: 'POST',
            path: '/v2/subjects/profile/verify/sms',
            title: 'Verify profile using SMS code',
            bodyTemplate: { phone: '+15551234567', code: '12345678', session: 'session-token' },
          },
          {
            id: 'create-verification-code',
            method: 'POST',
            path: '/v2/subjects/profile/verification-code',
            title: 'Create profile verification code',
            auth: 'osano',
            bodyTemplate: { email: 'user@example.com' },
          },
        ],
      },

      {
        id: 'sessions-config',
        name: 'Sessions · Config · Token · Health',
        endpoints: [
          {
            id: 'get-session',
            method: 'GET',
            path: '/v2/sessions/{sessionId}',
            title: 'Retrieve session',
            pathParams: ['sessionId'],
          },
          {
            id: 'get-config',
            method: 'GET',
            path: '/v2/config',
            title: 'Retrieve the UC config',
          },
          {
            id: 'create-token',
            method: 'POST',
            path: '/v2/token/create',
            title: 'Create a UC token (bootstrap)',
            auth: 'none',
            bodyTemplate: { configId: 'your-config-id', customerId: 'your-customer-id' },
          },
          {
            id: 'health',
            method: 'GET',
            path: '/',
            title: 'Health check',
            auth: 'none',
          },
        ],
      },
    ],
  },
];

window.APIS = APIS;
