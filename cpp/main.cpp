#include "Eval.h"
#include "Movie.h"
#include "CorrelationAdjuster.h"
#include "WeightedGraph.h"
#include <cmath>
#include <stdexcept>
#include <memory>
using namespace std;

#include <nlohmann/json.hpp>
using json = nlohmann::json;

struct QueryItem {
    int id;
    double weight;
};

struct ResultItem {
    int id;
    double score;
};

void from_json(const json& j, QueryItem& p) {
    j.at("id").get_to(p.id);
    j.at("w").get_to(p.weight);
}

void to_json(json& j, const ResultItem& p) {
    j = json{{"id", p.id}, {"score", p.score}};
}

int main (int argc, char *argv[]) {
    string data_dir = "movielens";
    double alpha_index = 0.2;
    Movie movie;
    WeightedGraph graph(data_dir);
    assert(graph.get_is_weighted());
    const int n = graph.node_size();
    const int walk_count = pow(10, 6);
    const int k = 100;
    const double alpha = 0.2;
    
    vector<double> node_to_dc = graph.calc_degree_centrality();
    vector<double> node_to_l2_normalized_dc;
    double norm = l2_norm(node_to_dc);
    for (int node_id = 0; node_id < n; node_id++) {
        node_to_l2_normalized_dc.push_back(node_to_dc.at(node_id) / norm);
    }

    vector<pair<int, double>> ordered_dc = get_ordered_vector(node_to_l2_normalized_dc);
    movie.set_ordered_dc(ordered_dc);

    map<int, double> movie_to_weight;

    cout << json{{"status", "ready"}}.dump() << endl;

    /* Query Phase */
    map<int, double> ppr_map;
    string line;
    while (getline(cin, line)) {
        if (line.empty()) {
            continue;
        }

        try {
            json query_json = json::parse(line);
            string type = query_json.at("type").get<string>();

            if (type == "analyze") {
                vector<QueryItem> query_items = query_json.at("queries").get<vector<QueryItem>>();
                movie_to_weight.clear();
                for (const QueryItem& item : query_items) {
                    movie_to_weight.emplace(item.id, item.weight);
                }

                ppr_map = graph.calc_ppr_by_fora(movie_to_weight, walk_count, alpha);
        
                ppr_map.erase(-1);
                for (const auto&[movie_id, weight] : movie_to_weight) {
                    ppr_map.erase(movie_id);
                }

                // return the result if cosine similarity is 0
                CorrelationAdjuster adjuster(ppr_map, node_to_l2_normalized_dc);
                map<int, double> decreased_ppr;
                double c = adjuster.calc_influence_decreased_ppr(0, decreased_ppr);

                const auto ordered_ppr = get_ordered_map(decreased_ppr);
                json result_json;
                vector<ResultItem> results;
                for (int i = 0; i < min(k, (int)ordered_ppr.size()); i++) {
                    int node_id = ordered_ppr.at(i).first;
                    double score = ordered_ppr.at(i).second;
                    results.push_back(ResultItem{node_id, score});
                }
                result_json = results;
                cout << result_json.dump() << endl;
            }

            else if (type == "adjust") {
                if (ppr_map.empty()) {
                    throw runtime_error("PPR map is empty. Perform 'analyze' query first.");
                }
                double cosine_similarity = query_json.at("c").get<double>();
                CorrelationAdjuster adjuster(ppr_map, node_to_l2_normalized_dc);
                map<int, double> decreased_ppr;
                double c = adjuster.calc_influence_decreased_ppr(cosine_similarity, decreased_ppr);
                for (const auto&[movie_id, weight] : movie_to_weight) {
                    decreased_ppr.erase(movie_id);
                }
                // c : 次数中心性を射影して定数倍して加減算する際の定数

                const auto ordered_ppr = get_ordered_map(decreased_ppr);
                json result_json;
                vector<ResultItem> results;
                for (int i = 0; i < min(k, (int)ordered_ppr.size()); i++) {
                    int node_id = ordered_ppr.at(i).first;
                    double score = ordered_ppr.at(i).second;
                    results.push_back(ResultItem{node_id, score});
                }
                result_json = results;
                cout << result_json.dump() << endl;
            }

        } catch (const std::exception& e) {
            json err;
            err["status"] = "error";
            err["message"] = e.what();
            std::cout << err.dump() << std::endl;
        }
    }
    return 0;
}