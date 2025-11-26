/* eslint-disable */
/* tslint:disable */
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

export interface SnippetContentsAdd {
  label: string;
  value: string | null;
  language: string;
}

export interface SnippetContentsUpdate {
  label?: string;
  value?: string | null;
  language?: string;
}

export interface SnippetsAdd {
  name: string;
  folderId?:
    | (
        | string
        | (
            | string
            | (string | (string | (string | (string | (string | number)))))
          )
      )
    | null;
}

export interface SnippetsUpdate {
  name?: string;
  folderId?:
    | (
        | string
        | (
            | string
            | (string | (string | (string | (string | (string | number)))))
          )
      )
    | null;
  description?: string | null;
  /**
   * @min 0
   * @max 1
   */
  isDeleted?:
    | string
    | (string | (string | (string | (string | (string | (string | number))))));
  /**
   * @min 0
   * @max 1
   */
  isFavorites?:
    | string
    | (string | (string | (string | (string | (string | (string | number))))));
}

export interface SnippetsCountsResponse {
  total:
    | string
    | (string | (string | (string | (string | (string | (string | number))))));
  trash:
    | string
    | (string | (string | (string | (string | (string | (string | number))))));
}

export interface SnippetsQuery {
  search?: string;
  sort?: string;
  order?: "ASC" | "DESC";
  folderId?:
    | string
    | (
        | string
        | (
            | string
            | (string | (string | (string | (string | (string | number)))))
          )
      );
  tagId?:
    | string
    | (
        | string
        | (
            | string
            | (string | (string | (string | (string | (string | number)))))
          )
      );
  /**
   * @min 0
   * @max 1
   */
  isFavorites?:
    | string
    | (
        | string
        | (
            | string
            | (string | (string | (string | (string | (string | number)))))
          )
      );
  /**
   * @min 0
   * @max 1
   */
  isDeleted?:
    | string
    | (
        | string
        | (
            | string
            | (string | (string | (string | (string | (string | number)))))
          )
      );
  /**
   * @min 0
   * @max 1
   */
  isInbox?:
    | string
    | (
        | string
        | (
            | string
            | (string | (string | (string | (string | (string | number)))))
          )
      );
}

export type SnippetsResponse = {
  id: number;
  name: string;
  description: string | null;
  tags: {
    id: number;
    name: string;
  }[];
  folder: {
    id: number;
    name: string;
  } | null;
  contents: {
    id: number;
    label: string;
    value: string | null;
    language: string;
  }[];
  isFavorites: number;
  isDeleted: number;
  createdAt: number;
  updatedAt: number;
}[];

export interface FoldersAdd {
  name: string;
  parentId?:
    | (string | (string | (string | (string | (string | (string | number))))))
    | null;
}

export type FoldersResponse = {
  id: number;
  name: string;
  createdAt: number;
  updatedAt: number;
  icon: string | null;
  parentId: number | null;
  isOpen: number;
  defaultLanguage: string;
  orderIndex: number;
}[];

export interface FoldersUpdate {
  name?: string;
  icon?: string | null;
  defaultLanguage?: string;
  parentId?:
    | (string | (string | (string | (string | (string | (string | number))))))
    | null;
  /**
   * @min 0
   * @max 1
   */
  isOpen?:
    | string
    | (string | (string | (string | (string | (string | number)))));
  orderIndex?:
    | string
    | (string | (string | (string | (string | (string | number)))));
}

export type FoldersTreeResponse = {
  id: number;
  name: string;
  createdAt: number;
  updatedAt: number;
  icon: string | null;
  parentId: number | null;
  isOpen: number;
  defaultLanguage: string;
  orderIndex: number;
  children: any[];
}[];

export interface TagsAdd {
  name: string;
}

export type TagsResponse = {
  id: number;
  name: string;
}[];

export interface TagsAddResponse {
  id: string | (string | (string | (string | (string | number))));
}

export type QueryParamsType = Record<string | number, any>;
export type ResponseFormat = keyof Omit<Body, "body" | "bodyUsed">;

export interface FullRequestParams extends Omit<RequestInit, "body"> {
  /** set parameter to `true` for call `securityWorker` for this request */
  secure?: boolean;
  /** request path */
  path: string;
  /** content type of request body */
  type?: ContentType;
  /** query params */
  query?: QueryParamsType;
  /** format of response (i.e. response.json() -> format: "json") */
  format?: ResponseFormat;
  /** request body */
  body?: unknown;
  /** base url */
  baseUrl?: string;
  /** request cancellation token */
  cancelToken?: CancelToken;
}

export type RequestParams = Omit<
  FullRequestParams,
  "body" | "method" | "query" | "path"
>;

export interface ApiConfig<SecurityDataType = unknown> {
  baseUrl?: string;
  baseApiParams?: Omit<RequestParams, "baseUrl" | "cancelToken" | "signal">;
  securityWorker?: (
    securityData: SecurityDataType | null,
  ) => Promise<RequestParams | void> | RequestParams | void;
  customFetch?: typeof fetch;
}

export interface HttpResponse<D extends unknown, E extends unknown = unknown>
  extends Response {
  data: D;
  error: E;
}

type CancelToken = Symbol | string | number;

export enum ContentType {
  Json = "application/json",
  FormData = "multipart/form-data",
  UrlEncoded = "application/x-www-form-urlencoded",
  Text = "text/plain",
}

export class HttpClient<SecurityDataType = unknown> {
  public baseUrl: string = "";
  private securityData: SecurityDataType | null = null;
  private securityWorker?: ApiConfig<SecurityDataType>["securityWorker"];
  private abortControllers = new Map<CancelToken, AbortController>();
  private customFetch = (...fetchParams: Parameters<typeof fetch>) =>
    fetch(...fetchParams);

  private baseApiParams: RequestParams = {
    credentials: "same-origin",
    headers: {},
    redirect: "follow",
    referrerPolicy: "no-referrer",
  };

  constructor(apiConfig: ApiConfig<SecurityDataType> = {}) {
    Object.assign(this, apiConfig);
  }

  public setSecurityData = (data: SecurityDataType | null) => {
    this.securityData = data;
  };

  protected encodeQueryParam(key: string, value: any) {
    const encodedKey = encodeURIComponent(key);
    return `${encodedKey}=${encodeURIComponent(typeof value === "number" ? value : `${value}`)}`;
  }

  protected addQueryParam(query: QueryParamsType, key: string) {
    return this.encodeQueryParam(key, query[key]);
  }

  protected addArrayQueryParam(query: QueryParamsType, key: string) {
    const value = query[key];
    return value.map((v: any) => this.encodeQueryParam(key, v)).join("&");
  }

  protected toQueryString(rawQuery?: QueryParamsType): string {
    const query = rawQuery || {};
    const keys = Object.keys(query).filter(
      (key) => "undefined" !== typeof query[key],
    );
    return keys
      .map((key) =>
        Array.isArray(query[key])
          ? this.addArrayQueryParam(query, key)
          : this.addQueryParam(query, key),
      )
      .join("&");
  }

  protected addQueryParams(rawQuery?: QueryParamsType): string {
    const queryString = this.toQueryString(rawQuery);
    return queryString ? `?${queryString}` : "";
  }

  private contentFormatters: Record<ContentType, (input: any) => any> = {
    [ContentType.Json]: (input: any) =>
      input !== null && (typeof input === "object" || typeof input === "string")
        ? JSON.stringify(input)
        : input,
    [ContentType.Text]: (input: any) =>
      input !== null && typeof input !== "string"
        ? JSON.stringify(input)
        : input,
    [ContentType.FormData]: (input: any) =>
      Object.keys(input || {}).reduce((formData, key) => {
        const property = input[key];
        formData.append(
          key,
          property instanceof Blob
            ? property
            : typeof property === "object" && property !== null
              ? JSON.stringify(property)
              : `${property}`,
        );
        return formData;
      }, new FormData()),
    [ContentType.UrlEncoded]: (input: any) => this.toQueryString(input),
  };

  protected mergeRequestParams(
    params1: RequestParams,
    params2?: RequestParams,
  ): RequestParams {
    return {
      ...this.baseApiParams,
      ...params1,
      ...(params2 || {}),
      headers: {
        ...(this.baseApiParams.headers || {}),
        ...(params1.headers || {}),
        ...((params2 && params2.headers) || {}),
      },
    };
  }

  protected createAbortSignal = (
    cancelToken: CancelToken,
  ): AbortSignal | undefined => {
    if (this.abortControllers.has(cancelToken)) {
      const abortController = this.abortControllers.get(cancelToken);
      if (abortController) {
        return abortController.signal;
      }
      return void 0;
    }

    const abortController = new AbortController();
    this.abortControllers.set(cancelToken, abortController);
    return abortController.signal;
  };

  public abortRequest = (cancelToken: CancelToken) => {
    const abortController = this.abortControllers.get(cancelToken);

    if (abortController) {
      abortController.abort();
      this.abortControllers.delete(cancelToken);
    }
  };

  public request = async <T = any, E = any>({
    body,
    secure,
    path,
    type,
    query,
    format,
    baseUrl,
    cancelToken,
    ...params
  }: FullRequestParams): Promise<HttpResponse<T, E>> => {
    const secureParams =
      ((typeof secure === "boolean" ? secure : this.baseApiParams.secure) &&
        this.securityWorker &&
        (await this.securityWorker(this.securityData))) ||
      {};
    const requestParams = this.mergeRequestParams(params, secureParams);
    const queryString = query && this.toQueryString(query);
    const payloadFormatter = this.contentFormatters[type || ContentType.Json];
    const responseFormat = format || requestParams.format;

    return this.customFetch(
      `${baseUrl || this.baseUrl || ""}${path}${queryString ? `?${queryString}` : ""}`,
      {
        ...requestParams,
        headers: {
          ...(requestParams.headers || {}),
          ...(type && type !== ContentType.FormData
            ? { "Content-Type": type }
            : {}),
        },
        signal:
          (cancelToken
            ? this.createAbortSignal(cancelToken)
            : requestParams.signal) || null,
        body:
          typeof body === "undefined" || body === null
            ? null
            : payloadFormatter(body),
      },
    ).then(async (response) => {
      const r = response.clone() as HttpResponse<T, E>;
      r.data = null as unknown as T;
      r.error = null as unknown as E;

      const data = !responseFormat
        ? r
        : await response[responseFormat]()
            .then((data) => {
              if (r.ok) {
                r.data = data;
              } else {
                r.error = data;
              }
              return r;
            })
            .catch((e) => {
              r.error = e;
              return r;
            });

      if (cancelToken) {
        this.abortControllers.delete(cancelToken);
      }

      if (!response.ok) throw data;
      return data;
    });
  };
}

/**
 * @title massCode API
 * @version 4.2.2
 *
 * Development documentation
 */
export class Api<
  SecurityDataType extends unknown,
> extends HttpClient<SecurityDataType> {
  snippets = {
    /**
     * No description
     *
     * @tags Snippets
     * @name GetSnippets
     * @request GET:/snippets/
     */
    getSnippets: (
      query?: {
        search?: string;
        sort?: string;
        order?: "ASC" | "DESC";
        folderId?:
          | string
          | (
              | string
              | (
                  | string
                  | (
                      | string
                      | (string | (string | (string | (string | number))))
                    )
                )
            );
        tagId?:
          | string
          | (
              | string
              | (
                  | string
                  | (
                      | string
                      | (string | (string | (string | (string | number))))
                    )
                )
            );
        /**
         * @min 0
         * @max 1
         */
        isFavorites?:
          | string
          | (
              | string
              | (
                  | string
                  | (
                      | string
                      | (string | (string | (string | (string | number))))
                    )
                )
            );
        /**
         * @min 0
         * @max 1
         */
        isDeleted?:
          | string
          | (
              | string
              | (
                  | string
                  | (
                      | string
                      | (string | (string | (string | (string | number))))
                    )
                )
            );
        /**
         * @min 0
         * @max 1
         */
        isInbox?:
          | string
          | (
              | string
              | (
                  | string
                  | (
                      | string
                      | (string | (string | (string | (string | number))))
                    )
                )
            );
      },
      params: RequestParams = {},
    ) =>
      this.request<SnippetsResponse, any>({
        path: `/snippets/`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Snippets
     * @name PostSnippets
     * @request POST:/snippets/
     */
    postSnippets: (data: SnippetsAdd, params: RequestParams = {}) =>
      this.request<
        {
          id: number | bigint;
        },
        any
      >({
        path: `/snippets/`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Snippets
     * @name GetSnippetsCounts
     * @request GET:/snippets/counts
     */
    getSnippetsCounts: (params: RequestParams = {}) =>
      this.request<SnippetsCountsResponse, any>({
        path: `/snippets/counts`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Snippets
     * @name PostSnippetsByIdContents
     * @request POST:/snippets/{id}/contents
     */
    postSnippetsByIdContents: (
      id: string,
      data: SnippetContentsAdd,
      params: RequestParams = {},
    ) =>
      this.request<
        {
          id: number | bigint;
        },
        any
      >({
        path: `/snippets/${id}/contents`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Snippets
     * @name PatchSnippetsById
     * @request PATCH:/snippets/{id}
     */
    patchSnippetsById: (
      id: string,
      data: SnippetsUpdate,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/snippets/${id}`,
        method: "PATCH",
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Snippets
     * @name DeleteSnippetsById
     * @request DELETE:/snippets/{id}
     */
    deleteSnippetsById: (id: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/snippets/${id}`,
        method: "DELETE",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Snippets
     * @name PatchSnippetsByIdContentsByContentId
     * @request PATCH:/snippets/{id}/contents/{contentId}
     */
    patchSnippetsByIdContentsByContentId: (
      id: string,
      contentId: string,
      data: SnippetContentsUpdate,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/snippets/${id}/contents/${contentId}`,
        method: "PATCH",
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Snippets
     * @name DeleteSnippetsByIdContentsByContentId
     * @request DELETE:/snippets/{id}/contents/{contentId}
     */
    deleteSnippetsByIdContentsByContentId: (
      id: string,
      contentId: string,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/snippets/${id}/contents/${contentId}`,
        method: "DELETE",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Snippets
     * @name PostSnippetsByIdTagsByTagId
     * @request POST:/snippets/{id}/tags/{tagId}
     */
    postSnippetsByIdTagsByTagId: (
      id: string,
      tagId: string,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/snippets/${id}/tags/${tagId}`,
        method: "POST",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Snippets
     * @name DeleteSnippetsByIdTagsByTagId
     * @request DELETE:/snippets/{id}/tags/{tagId}
     */
    deleteSnippetsByIdTagsByTagId: (
      id: string,
      tagId: string,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/snippets/${id}/tags/${tagId}`,
        method: "DELETE",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Snippets
     * @name DeleteSnippetsTrash
     * @request DELETE:/snippets/trash
     */
    deleteSnippetsTrash: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/snippets/trash`,
        method: "DELETE",
        ...params,
      }),
  };
  folders = {
    /**
     * No description
     *
     * @tags Folders
     * @name GetFolders
     * @request GET:/folders/
     */
    getFolders: (params: RequestParams = {}) =>
      this.request<FoldersResponse, any>({
        path: `/folders/`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Folders
     * @name PostFolders
     * @request POST:/folders/
     */
    postFolders: (data: FoldersAdd, params: RequestParams = {}) =>
      this.request<
        {
          id: number | bigint;
        },
        any
      >({
        path: `/folders/`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Folders
     * @name GetFoldersTree
     * @request GET:/folders/tree
     */
    getFoldersTree: (params: RequestParams = {}) =>
      this.request<FoldersTreeResponse, any>({
        path: `/folders/tree`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Folders
     * @name PatchFoldersById
     * @request PATCH:/folders/{id}
     */
    patchFoldersById: (
      id: string,
      data: FoldersUpdate,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/folders/${id}`,
        method: "PATCH",
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Folders
     * @name DeleteFoldersById
     * @request DELETE:/folders/{id}
     */
    deleteFoldersById: (id: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/folders/${id}`,
        method: "DELETE",
        ...params,
      }),
  };
  tags = {
    /**
     * No description
     *
     * @tags Tags
     * @name GetTags
     * @request GET:/tags/
     */
    getTags: (params: RequestParams = {}) =>
      this.request<TagsResponse, any>({
        path: `/tags/`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Tags
     * @name PostTags
     * @request POST:/tags/
     */
    postTags: (data: TagsAdd, params: RequestParams = {}) =>
      this.request<TagsAddResponse, any>({
        path: `/tags/`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Tags
     * @name DeleteTagsById
     * @request DELETE:/tags/{id}
     */
    deleteTagsById: (id: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/tags/${id}`,
        method: "DELETE",
        ...params,
      }),
  };
}
