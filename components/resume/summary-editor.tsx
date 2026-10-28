import { WordingField } from "@/components/resume/wording-field";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { EditorProps } from "@/types-and-constants/editor";
import type { Issue } from "@/types-and-constants/review";

export function SummaryEditor({
  document,
  locale,
  update,
  errors,
}: Pick<EditorProps, "document" | "locale" | "update"> & { errors: Issue[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle size="section">Summary</CardTitle>
        <CardDescription>
          Shared text for this language. Individual resumes can use customized
          wording.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <WordingField
          document={document}
          path="profile.summary"
          locale={locale}
          update={update}
          label="Summary"
          multiline
          errors={errors}
        />
      </CardContent>
    </Card>
  );
}
