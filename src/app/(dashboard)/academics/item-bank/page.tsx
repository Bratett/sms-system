import { auth } from "@/lib/auth";
import {
  listItemBankQuestionsAction,
  listItemBankPapersAction,
  listItemBankTagsAction,
} from "@/modules/academics/actions/item-bank.action";
import { getSubjectsAction } from "@/modules/academics/actions/subject.action";
import { ItemBankClient } from "./item-bank-client";

export default async function ItemBankPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [questions, papers, tags, subjects] = await Promise.all([
    listItemBankQuestionsAction({ pageSize: 100 }),
    listItemBankPapersAction(),
    listItemBankTagsAction(),
    getSubjectsAction(),
  ]);

  return (
    <ItemBankClient
      initialQuestions={"data" in questions ? questions.data.questions : []}
      initialPapers={"data" in papers ? papers.data : []}
      tags={"data" in tags ? tags.data : []}
      subjects={"data" in subjects ? subjects.data : []}
    />
  );
}
