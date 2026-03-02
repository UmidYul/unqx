import { CardEditor } from "@/components/admin/card-editor";

export default function NewCardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">Создать визитку</h1>
      <CardEditor
        mode="create"
        initialValues={{
          slug: "",
          isActive: true,
          name: "",
          phone: "",
          verified: false,
          hashtag: undefined,
          address: undefined,
          postcode: undefined,
          email: undefined,
          extraPhone: undefined,
          tags: [],
          buttons: [],
        }}
      />
    </div>
  );
}
