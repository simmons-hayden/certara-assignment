export interface JobDto {
  websiteTitle: string;
  websiteOrganization: string;
  websiteLocation: string;
  websiteDatePublished: string;
}

export interface ApiResponse {
  searches: JobDto[];
}
