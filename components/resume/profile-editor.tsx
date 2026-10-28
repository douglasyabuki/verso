import { TextField } from "@/components/resume/fields";
import { LinksEditor } from "@/components/resume/links-editor";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import { InfoHint } from "@/components/ui/info-hint";
import { Separator } from "@/components/ui/separator";
import type { EditorProps } from "@/types-and-constants/editor";
import type { Issue } from "@/types-and-constants/review";

export function ProfileEditor({
  document,
  update,
  confirm,
  errors,
}: Pick<EditorProps, "document" | "update" | "confirm"> & { errors: Issue[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle size="section">Your profile</CardTitle>
        <CardDescription className="flex items-center gap-1.5">
          <span>Shared contact details</span>
          <InfoHint label="profile languages">
            Contact details apply to both languages and all resumes.
          </InfoHint>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <TextField
            fieldKey="profile.name"
            label="Full name"
            value={document.profile.name}
            maxLength={200}
            onChange={(name, group) =>
              update((draft) => {
                draft.profile.name = name;
              }, group)
            }
            error={
              errors.find((error) => error.path === "profile.name")?.message
            }
            placeholder="Your name"
          />
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <TextField
              fieldKey="profile.email"
              label="Email"
              type="email"
              value={document.profile.email}
              maxLength={300}
              onChange={(email, group) =>
                update((draft) => {
                  draft.profile.email = email;
                }, group)
              }
              error={
                errors.find((error) => error.path === "profile.email")?.message
              }
              placeholder="you@example.com"
            />
            <TextField
              fieldKey="profile.phone"
              label="Phone"
              type="tel"
              value={document.profile.phone}
              error={
                errors.find((error) => error.path === "profile.phone")?.message
              }
              maxLength={100}
              onChange={(phone, group) =>
                update((draft) => {
                  draft.profile.phone = phone;
                }, group)
              }
            />
            <TextField
              fieldKey="profile.city"
              label="City"
              value={document.profile.city}
              maxLength={200}
              onChange={(city, group) =>
                update((draft) => {
                  draft.profile.city = city;
                }, group)
              }
            />
            <TextField
              fieldKey="profile.country"
              label="Country code"
              value={document.profile.country}
              error={
                errors.find((error) => error.path === "profile.country")
                  ?.message
              }
              maxLength={2}
              onChange={(country, group) =>
                update((draft) => {
                  draft.profile.country = country.toUpperCase();
                }, group)
              }
              placeholder="BR"
              description="Two letters, for example BR or US. The PDF shows the country name in the selected language."
            />
          </FieldGroup>
          <Separator />
          <FieldSet>
            <FieldLegend>Social & website links</FieldLegend>
            <LinksEditor
              document={document}
              scope="library:profile:links"
              links={document.profile.links}
              onChange={(links, group) =>
                update((draft) => {
                  draft.profile.links = links;
                }, group)
              }
              confirm={confirm}
            />
          </FieldSet>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
